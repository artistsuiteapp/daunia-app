/**
 * I conti del tabellone a mano, senza React e senza rete.
 *
 * Stanno qui per essere provati: la schermata del pannello ci mette intorno i
 * tasti, ma le cose che possono sbagliare -- da che parte del campo va un gol,
 * che minuto scrivere, chi mettere in cima all'elenco dei marcatori -- sono
 * queste, e sono sotto test.
 */

export type Lato = 'casa' | 'ospiti';

/** Da che parte del campo finisce un gol, conoscendo chi l'ha segnato. */
export function latoDi(nostro: boolean, foggiaInCasa: boolean): Lato {
  return nostro === foggiaInCasa ? 'casa' : 'ospiti';
}

/**
 * Il minuto da scrivere sul gol, partendo da quello sul tabellone.
 *
 * Il minuto dal vivo arriva anche col recupero ("90+3"): li si somma, perche
 * la cronaca ordina per numero e "90+3" non e un numero. Prima del fischio, o
 * quando il minuto non si sa, torna null: meglio un gol senza minuto che un
 * gol al minuto sbagliato.
 */
export function minutoOra(minuto: string | null | undefined): number | null {
  const m = /^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?$/.exec(String(minuto ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]) + (m[2] ? Number(m[2]) : 0);
  return n > 0 && n <= 130 ? n : null;
}

export type Marcatore = { id: string | null; nome: string; numero: number | null; inCampo: boolean };

const cognome = (s: string) => String(s ?? '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).pop() ?? '';

/**
 * Chi puo aver segnato, in un elenco pronto da premere.
 *
 * Prima i titolari di oggi, in ordine di numero: durante la partita e da li
 * che si sceglie nove volte su dieci, e cercare un nome fra venticinque in
 * trenta secondi non si fa. Sotto, il resto della rosa.
 *
 * Chi e in campo ma non e in rosa nei dati -- un arrivato all'ultimo giorno di
 * mercato -- compare lo stesso: la formazione di oggi vale piu dell'elenco
 * scaricato ieri.
 */
export function elencoMarcatori(
  rosa: ReadonlyArray<{ id: string; name: string; shortName: string; number: number | null }>,
  inCampo?: ReadonlyArray<{ numero: number | null; nome: string }> | null,
): Marcatore[] {
  const titolari: Marcatore[] = [];
  const visti = new Set<string>();

  for (const g of inCampo ?? []) {
    const c = cognome(g.nome);
    const suo = rosa.find((p) => cognome(p.shortName) === c || cognome(p.name) === c);
    visti.add(c);
    titolari.push({
      id: suo?.id ?? null,
      nome: suo?.shortName ?? g.nome,
      numero: g.numero ?? suo?.number ?? null,
      inCampo: true,
    });
  }
  titolari.sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99));

  const panchina = rosa
    .filter((p) => !visti.has(cognome(p.shortName)) && !visti.has(cognome(p.name)))
    .map((p) => ({ id: p.id, nome: p.shortName, numero: p.number, inCampo: false }))
    .sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99));

  return [...titolari, ...panchina];
}

/**
 * Cosa dicono le fonti, quando non dicono quello che c'e sul tabellone.
 *
 * E l'unico controllo che ha chi sta segnando a mano: se le fonti sono avanti,
 * o e arrivato un gol che non ha visto, o ne ha segnato uno di troppo. Torna
 * null quando sono d'accordo, cioe quasi sempre: un avviso che c'e sempre non
 * lo legge piu nessuno.
 */
export function discordanza(
  mano: { casa: number | null; ospiti: number | null },
  fonti: { casa: number | null; ospiti: number | null },
): string | null {
  if (fonti.casa == null || fonti.ospiti == null) return null;
  if (mano.casa === fonti.casa && mano.ospiti === fonti.ospiti) return null;
  return `Le fonti dicono ${fonti.casa}-${fonti.ospiti}`;
}
