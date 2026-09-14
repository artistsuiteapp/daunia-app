/**
 * Un database finto, abbastanza vero per il guardiano.
 *
 * Imita solo i pezzi del client Supabase che il guardiano usa davvero:
 * select, insert, update, delete, i filtri eq/in/not, order, limit,
 * maybeSingle e rpc. Tiene le righe in memoria e ricorda ogni scrittura, cosi
 * un test puo chiedere "cosa c'era nella riga al minuto 23".
 *
 * Non e un Postgres: niente trigger e niente vincoli. Quello che succede nel
 * database vero si prova in `supabase/test/`, con PGlite.
 */

type Riga = Record<string, unknown>;
type Filtro = (r: Riga) => boolean;

/** "preferenze->>gol" legge dentro un json, come fa PostgREST */
function leggi(r: Riga, colonna: string): unknown {
  const [base, chiave] = colonna.split('->>');
  const v = r[base];
  if (chiave === undefined) return v;
  const dentro = (v as Record<string, unknown> | null | undefined)?.[chiave];
  return dentro === undefined || dentro === null ? null : String(dentro);
}

const copia = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

export function fintoDb(
  tabelle: Record<string, Riga[]>,
  rpc: Record<string, (args: Record<string, unknown>) => unknown> = {},
  /** chiamata dopo ogni update: serve a fotografare la riga nell'istante in cui cambia */
  dopoAggiornamento: (tabella: string) => void = () => {},
) {
  const scritture: Array<{ tabella: string; op: string; valori: unknown }> = [];

  class Domanda implements PromiseLike<{ data: unknown; error: null }> {
    op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    valori: Riga | Riga[] | null = null;
    filtri: Filtro[] = [];
    ordine: { colonna: string; crescente: boolean } | null = null;
    limite: number | null = null;
    singola = false;
    readonly tabella: string;

    constructor(tabella: string) { this.tabella = tabella; }

    select() { return this; }
    insert(v: Riga | Riga[]) { this.op = 'insert'; this.valori = v; return this; }
    update(v: Riga) { this.op = 'update'; this.valori = v; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c: string, v: unknown) { this.filtri.push((r) => String(leggi(r, c)) === String(v)); return this; }
    in(c: string, vs: unknown[]) {
      const ammessi = new Set(vs.map(String));
      this.filtri.push((r) => ammessi.has(String(leggi(r, c))));
      return this;
    }
    not(c: string, op: string, v: unknown) {
      if (op !== 'is' || v !== null) throw new Error(`not(${op}) non imitato`);
      this.filtri.push((r) => leggi(r, c) !== null && leggi(r, c) !== undefined);
      return this;
    }
    order(c: string, o?: { ascending?: boolean }) {
      this.ordine = { colonna: c, crescente: o?.ascending !== false };
      return this;
    }
    limit(n: number) { this.limite = n; return this; }
    maybeSingle() { this.singola = true; return this; }

    private esegui(): { data: unknown; error: null } {
      const righe = (tabelle[this.tabella] ??= []);
      const scelte = righe.filter((r) => this.filtri.every((f) => f(r)));

      if (this.op === 'insert') {
        const nuove = (Array.isArray(this.valori) ? this.valori : [this.valori]) as Riga[];
        for (const n of nuove) righe.push(copia(n));
        scritture.push({ tabella: this.tabella, op: 'insert', valori: copia(this.valori) });
        return { data: null, error: null };
      }
      if (this.op === 'update') {
        for (const r of scelte) Object.assign(r, copia(this.valori));
        scritture.push({ tabella: this.tabella, op: 'update', valori: copia(this.valori) });
        dopoAggiornamento(this.tabella);
        return { data: null, error: null };
      }
      if (this.op === 'delete') {
        tabelle[this.tabella] = righe.filter((r) => !scelte.includes(r));
        return { data: null, error: null };
      }

      let fuori = scelte.map(copia);
      if (this.ordine) {
        const { colonna, crescente } = this.ordine;
        const valore = (r: Riga) => {
          const v = r[colonna];
          const t = typeof v === 'string' ? Date.parse(v) : NaN;
          return Number.isFinite(t) ? t : Number(v);
        };
        fuori.sort((a, b) => (crescente ? 1 : -1) * (valore(a) - valore(b)));
      }
      if (this.limite !== null) fuori = fuori.slice(0, this.limite);
      if (this.singola) return { data: fuori[0] ?? null, error: null };
      return { data: fuori, error: null };
    }

    then<A, B>(
      ok?: ((v: { data: unknown; error: null }) => A | PromiseLike<A>) | null,
      ko?: ((e: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      return Promise.resolve().then(() => this.esegui()).then(ok, ko);
    }
  }

  return {
    tabelle,
    scritture,
    from: (tabella: string) => new Domanda(tabella),
    rpc: (nome: string, args: Record<string, unknown>) =>
      Promise.resolve({ data: rpc[nome] ? rpc[nome](args) : null, error: null }),
  };
}
