/**
 * Chi ha ragione sul punteggio.
 *
 * Il guardiano ha due fonti che parlano della stessa partita e non vanno mai
 * d'accordo allo stesso istante: il tabellone di TheSportsDB e gli eventi di
 * API-Football. Prima il titolo della notifica prendeva il gol da una e il
 * numero dall'altra, quindi nel momento in cui le due erano disallineate --
 * cioe' esattamente quando serve -- annunciava "GOL DEL FOGGIA! 0-0".
 *
 * Qui dentro le fonti si contano e si confrontano. Se concordano il numero si
 * stampa. Se no, non si stampa un numero inventato: si stampa il minuto e chi
 * ha segnato, che sono fatti, e il punteggio si tace.
 *
 * Niente rete e niente stato: si prova con node --test.
 */

export type Punteggio = { casa: number; ospiti: number };

export type EventoAF = {
  type?: string;
  detail?: string;
  comments?: string | null;
  time?: { elapsed?: number | null };
  team?: { id?: number };
  player?: { name?: string | null };
};

/**
 * Un gol che conta davvero.
 *
 * API-Football usa type "Goal" anche per il rigore sbagliato (detail "Missed
 * Penalty") e per i tiri dei rigori finali. Contarli sarebbe un gol annunciato
 * che non esiste, ed e' il tipo di errore che nessuno perdona a un'app di
 * tifosi.
 */
export function golVero(x: EventoAF): boolean {
  if (x.type !== 'Goal') return false;
  if (x.detail === 'Missed Penalty') return false;
  if (String(x.comments ?? '').includes('Penalty Shootout')) return false;
  return true;
}

/**
 * Il punteggio contato dagli eventi.
 *
 * L'autogol in API-Football porta la squadra di chi lo segna, non di chi ne
 * guadagna: va girato, altrimenti il conto si sposta dalla parte sbagliata.
 * L'avversario non serve saperlo per nome: tutto quello che non e' nostro e'
 * loro.
 */
export function contaGol(eventi: EventoAF[], nostroId: number, inCasa: boolean): Punteggio {
  let nostri = 0;
  let loro = 0;
  for (const x of eventi) {
    if (!golVero(x)) continue;
    const nostroGiocatore = x.team?.id === nostroId;
    const autogol = x.detail === 'Own Goal';
    if (nostroGiocatore !== autogol) nostri += 1;
    else loro += 1;
  }
  return inCasa ? { casa: nostri, ospiti: loro } : { casa: loro, ospiti: nostri };
}

export type Fonte = 'accordo' | 'eventi' | 'tabellone' | 'arbitro' | 'nessuna';

export type Accordo = {
  /** null quando nessuna fonte ha parlato */
  punteggio: Punteggio | null;
  /** true solo se due fonti indipendenti dicono lo stesso numero */
  concordi: boolean;
  fonte: Fonte;
};

const uguali = (a: Punteggio | null, b: Punteggio | null) =>
  !!a && !!b && a.casa === b.casa && a.ospiti === b.ospiti;

/**
 * Mette d'accordo le fonti.
 *
 * `arbitro` e' la terza, il punteggio chiesto direttamente ad API-Football. Si
 * paga una chiamata, quindi arriva solo quando le prime due litigano: due su
 * tre chiudono la questione.
 */
export function concorda(
  tabellone: Punteggio | null,
  eventi: Punteggio | null,
  arbitro: Punteggio | null = null,
): Accordo {
  if (uguali(tabellone, eventi)) return { punteggio: tabellone, concordi: true, fonte: 'accordo' };
  if (uguali(tabellone, arbitro)) return { punteggio: tabellone, concordi: true, fonte: 'accordo' };
  if (uguali(eventi, arbitro)) return { punteggio: eventi, concordi: true, fonte: 'accordo' };

  // Nessuna coppia: si dice da dove viene il numero, e che non e' confermato.
  if (arbitro) return { punteggio: arbitro, concordi: false, fonte: 'arbitro' };
  if (eventi) return { punteggio: eventi, concordi: false, fonte: 'eventi' };
  if (tabellone) return { punteggio: tabellone, concordi: false, fonte: 'tabellone' };
  return { punteggio: null, concordi: false, fonte: 'nessuna' };
}

/**
 * Il titolo della notifica di un gol.
 *
 * Il numero compare solo se due fonti lo confermano. Meglio "GOL DEL FOGGIA!"
 * senza punteggio che con quello sbagliato: il primo lascia l'esultanza intera,
 * il secondo la corregge dopo trenta secondi.
 */
export function titoloGol(nostro: boolean, a: Accordo): string {
  const testa = nostro ? 'GOL DEL FOGGIA!' : 'Gol subito.';
  if (!a.concordi || !a.punteggio) return testa;
  return `${testa} ${a.punteggio.casa}-${a.punteggio.ospiti}`;
}

/**
 * Chi ha segnato, guardando solo come si e' mosso il tabellone.
 *
 * Serve quando API-Football non ha eventi per questa partita: la Serie C ha
 * buchi di copertura, e prima in quel caso non partiva nessuna notifica. Il
 * marcatore non si sa, ma che sia stato segnato un gol si sa benissimo.
 */
export function golDalTabellone(
  prima: Punteggio | null,
  adesso: Punteggio | null,
  inCasa: boolean,
): { nostro: boolean } | null {
  if (!adesso || !prima) return null;
  const suCasa = adesso.casa - prima.casa;
  const suOspiti = adesso.ospiti - prima.ospiti;
  if (suCasa <= 0 && suOspiti <= 0) return null;
  // Se salgono tutti e due fra un giro e l'altro, i gol sono due e ne esce una
  // notifica sola. Ma se il nostro lato e' salito, il Foggia ha segnato: quello
  // e' vero comunque, e si annuncia quello.
  const nostroLato = inCasa ? suCasa : suOspiti;
  return { nostro: nostroLato > 0 };
}
