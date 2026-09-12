import { useMemo } from 'react';
import type { Match, TeamStats } from '@satanelli/core';

import { matches, stats as statsArchivio } from './data';
import { useLive, liveDi, useGolVivo } from './live';
import { fondi, ultimaGiocata, conLaPartitaNuova } from './partita-corrente-core.ts';

/**
 * Le partite come stanno adesso, non come stavano all'ultima pubblicazione.
 *
 * Da qui passano tutte le schermate che mostrano un risultato. Il calendario
 * resta quello dell'archivio; il dal vivo ha ragione sulla partita che il
 * guardiano sta seguendo. I conti veri stanno in partita-corrente-core.ts, che
 * e' senza React e sotto test: qui c'e' solo l'aggancio.
 *
 * La riga dal vivo e' una sola, quella della partita in corso o appena finita:
 * tutto il resto del calendario resta com'e'.
 */

/**
 * Quale partita del calendario e' quella che il guardiano sta seguendo.
 *
 * Non si confrontano gli identificativi -- le due fonti usano i loro, e non
 * combaciano -- ma `liveDi`, che riconosce la partita da orario e squadra di
 * casa e restituisce null quando il dato non la riguarda.
 */
function quale(live: ReturnType<typeof useLive>): Match | null {
  if (!live) return null;
  return matches.find((m) => liveDi(m, live) !== null) ?? null;
}

export function usePartite(): {
  partite: Match[];
  /** l'ultima giocata, compresa quella appena finita */
  ultima: Match | null;
  /** quella che si sta giocando adesso, se c'e' */
  inCorso: Match | null;
  /** true quando il dal vivo sta aggiungendo qualcosa all'archivio */
  fusa: boolean;
} {
  const live = useLive();
  const gol = useGolVivo();

  return useMemo(() => {
    const seguita = quale(live);
    const orientato = liveDi(seguita, live);

    if (!seguita || !orientato) {
      return {
        partite: matches,
        ultima: ultimaGiocata(matches),
        inCorso: null,
        fusa: false,
      };
    }

    const aggiornata = fondi(seguita, orientato, gol);
    const partite = matches.map((m) => (m.id === seguita.id ? aggiornata : m));

    return {
      partite,
      ultima: ultimaGiocata(partite),
      inCorso: aggiornata.status === 'live' ? aggiornata : null,
      fusa: aggiornata !== seguita,
    };
  }, [live, gol]);
}

/** Solo l'ultima giocata, per chi non ha bisogno del resto. */
export function useUltimaPartita(): Match | null {
  return usePartite().ultima;
}

/**
 * Le statistiche, con dentro anche la partita che l'archivio non ha ancora visto.
 *
 * Si aggiunge SOLO se l'archivio non l'aveva gia' contata: altrimenti i gol
 * verrebbero sommati due volte, e il difetto sarebbe invisibile finche' qualcuno
 * non fa il conto a mano.
 *
 * `nuova` dice se sta succedendo, cosi la schermata puo' scriverlo: numeri che
 * cambiano senza spiegazione fanno dubitare di tutti gli altri.
 */
export function useStatistiche(): { stats: TeamStats; nuova: Match | null } {
  const { partite } = usePartite();

  return useMemo(() => {
    const ultima = ultimaGiocata(partite);
    if (!ultima) return { stats: statsArchivio, nuova: null };

    const inArchivio = matches.find((m) => m.id === ultima.id);
    const giaContata = inArchivio?.status === 'finished' && inArchivio.score !== null;
    if (giaContata) return { stats: statsArchivio, nuova: null };

    return { stats: conLaPartitaNuova(statsArchivio, ultima), nuova: ultima };
  }, [partite]);
}
