/**
 * Il calendario che il guardiano passa al database.
 *
 * Serve a un ponte: l'app chiama le partite `wp-2026-2027-004`, il guardiano
 * `2555023`. Senza il calendario nel database nessuno dei due trovava i
 * pronostici dell'altro, e i punti per esito e risultato non sono mai stati
 * pagati. Il ponte vero lo fa `allinea_calendario`, in SQL: qui si decide solo
 * cosa e affidabile abbastanza da mandargli.
 *
 * Niente rete e niente database, cosi si prova.
 */

export type RigaCalendario = {
  partita: string;
  kickoff: string;
  casa: number | null;
  ospiti: number | null;
  finita: boolean;
};

const ID = /^[A-Za-z0-9_.:-]{1,64}$/;

function gol(x: unknown): number | null {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isInteger(n) && n >= 0 && n <= 30 ? n : null;
}

/**
 * Le partite del file `data/matches.json`, ripulite.
 *
 * Una partita e "finita" solo se il calendario lo dice E porta il punteggio:
 * con quel punteggio il database chiude la partita e paga i punti, e un
 * risultato a meta non deve pagare niente.
 */
export function calendarioDa(grezzo: unknown): RigaCalendario[] {
  const elenco = Array.isArray(grezzo)
    ? grezzo
    : Array.isArray((grezzo as { matches?: unknown })?.matches)
      ? (grezzo as { matches: unknown[] }).matches
      : [];

  const visti = new Set<string>();
  const fuori: RigaCalendario[] = [];
  for (const voce of elenco) {
    const m = voce as { id?: unknown; kickoff?: unknown; status?: unknown; score?: { home?: unknown; away?: unknown } | null };
    const partita = typeof m?.id === 'string' ? m.id : '';
    if (!ID.test(partita) || visti.has(partita)) continue;

    const quando = typeof m.kickoff === 'string' ? Date.parse(m.kickoff) : NaN;
    if (!Number.isFinite(quando)) continue;

    const casa = gol(m.score?.home);
    const ospiti = gol(m.score?.away);
    visti.add(partita);
    fuori.push({
      partita,
      kickoff: new Date(quando).toISOString(),
      casa,
      ospiti,
      finita: m.status === 'finished' && casa !== null && ospiti !== null,
    });
  }
  return fuori;
}

/** Vero se e passato abbastanza dall'ultimo allineamento, o se non ce n'e mai stato uno. */
export function daAllineare(ultimo: string | null | undefined, adesso: number, pausa: number): boolean {
  const t = ultimo ? Date.parse(ultimo) : NaN;
  if (!Number.isFinite(t)) return true;
  // un orologio avanti nel database non deve fermare gli allineamenti per sempre
  if (t > adesso + pausa) return true;
  return adesso - t >= pausa;
}

/**
 * La "prossima" di TheSportsDB e davvero prossima?
 *
 * Nelle ore dopo il fischio TheSportsDB restituisce ancora come prossima la
 * partita appena giocata. Il guardiano la riscriveva con il punteggio vuoto:
 * cosi Monopoli-Foggia, chiusa 1-0, e rimasta senza risultato.
 */
export function ancoraDaGiocare(kickoff: string, adesso: number, dopo: number): boolean {
  const t = Date.parse(kickoff);
  return Number.isFinite(t) && t + dopo >= adesso;
}
