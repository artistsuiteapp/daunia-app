/**
 * Quando si vota e quando si proclama.
 *
 * Due premi con due ritmi diversi:
 *
 * Il **migliore in campo** vive intorno a una partita. Si vota nelle
 * ventiquattro ore dopo il fischio finale, poi resta il risultato, e sparisce
 * il giorno prima della gara successiva -- perche da li in avanti la testa e
 * gia alla prossima, e un premio vecchio in home diventa arredamento.
 *
 * Il **migliore del mese** vive in home tutto il tempo. Durante il mese e una
 * classifica aperta che si muove; l'ultimo giorno le votazioni chiudono, e dal
 * primo del mese dopo resta il vincitore in versione piccola, finche non si
 * chiude il mese nuovo e lo sostituisce.
 *
 * Sono conti sulle date, cioe il posto dove si sbaglia: stanno qui, senza
 * React e senza dati, con i test sopra.
 */

const ORE = 60 * 60 * 1000;
const GIORNI = 24 * ORE;

/** Quanto dura la votazione dopo il triplice fischio. */
export const VOTAZIONE_APERTA = 24 * ORE;
/** Quanto prima della partita successiva il premio lascia la home. */
export const SPARISCE_PRIMA = 1 * GIORNI;

export type StatoPremio =
  /** si vota: la partita e finita da meno di ventiquattro ore */
  | { fase: 'votazione'; scadeFra: number }
  /** votazioni chiuse, si mostra chi ha vinto */
  | { fase: 'risultato' }
  /** fuori tempo: troppo presto, troppo tardi, o si avvicina la prossima */
  | { fase: 'niente' };

/**
 * Lo stato del migliore in campo.
 *
 * `finitaIl` e l'istante del triplice fischio, non l'orario previsto: fra
 * recuperi e ritardi ballano dieci minuti, e la finestra di voto parte da
 * quando la partita e finita davvero.
 */
export function statoMigliore(
  finitaIl: string | number | null | undefined,
  prossimoKickoff: string | null | undefined,
  adesso = Date.now(),
): StatoPremio {
  const fine = typeof finitaIl === 'number' ? finitaIl : finitaIl ? Date.parse(finitaIl) : NaN;
  if (!Number.isFinite(fine) || adesso < fine) return { fase: 'niente' };

  // la prossima partita ha la precedenza: da un giorno prima si guarda avanti
  const prossima = prossimoKickoff ? Date.parse(prossimoKickoff) : NaN;
  if (Number.isFinite(prossima) && adesso >= prossima - SPARISCE_PRIMA) return { fase: 'niente' };

  const passate = adesso - fine;
  if (passate < VOTAZIONE_APERTA) return { fase: 'votazione', scadeFra: VOTAZIONE_APERTA - passate };
  return { fase: 'risultato' };
}

/** Il mese di una data, in forma "2026-09". */
export function chiaveMese(quando: Date | number | string): string {
  const d = quando instanceof Date ? quando : new Date(quando);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type StatoMese = {
  /** il mese di cui si parla, "2026-09" */
  mese: string;
  /** true quando il mese e chiuso e quello mostrato e un verdetto */
  chiuso: boolean;
};

/**
 * Quale mese mostrare, e se e ancora aperto.
 *
 * Dentro il mese si mostra il mese corrente, aperto. Dal primo giorno del mese
 * nuovo si mostra il mese appena chiuso, col suo vincitore, e resta li finche
 * non chiude anche quello nuovo.
 *
 * Il salto avviene a mezzanotte del primo: le votazioni si chiudono con
 * l'ultimo giorno del mese, come hai chiesto, e il verdetto compare il giorno
 * dopo senza che nessuno debba premere niente.
 */
export function statoMese(adesso: Date | number = Date.now()): StatoMese {
  const d = adesso instanceof Date ? adesso : new Date(adesso);

  // il primo del mese non c'e ancora niente da mostrare del mese in corso:
  // vale ancora il verdetto di quello prima
  const primoGiorno = d.getDate() === 1;
  if (primoGiorno) {
    const scorso = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return { mese: chiaveMese(scorso), chiuso: true };
  }
  return { mese: chiaveMese(d), chiuso: false };
}

/**
 * Il mese e chiuso: si mostra il verdetto e non si vota piu.
 *
 * Un mese e chiuso quando quello corrente e diverso da quello della classifica
 * che si sta guardando.
 */
export function meseChiuso(mese: string, adesso: Date | number = Date.now()): boolean {
  return mese !== chiaveMese(adesso);
}
