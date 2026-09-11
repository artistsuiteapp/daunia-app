/**
 * La carriera in maglia rossonera, dal 2000 in poi.
 *
 * DA DOVE ARRIVA
 *
 * Da Transfermarkt, letto a mano una volta sola l'11 settembre 2026. Non gira
 * in un cron e l'app non lo chiama: e un file fermo, come una fotografia. Da
 * li si prendono solo numeri -- presenze, gol, minuti -- mai immagini, stemmi
 * o loghi loro.
 *
 * Le loro pagine GIOCATORE oggi tornano senza tabelle: i dati li caricano
 * fuori dall'HTML. Quelle SQUADRA no, e danno la stessa cosa per tutti
 * insieme, stagione per stagione. E il motivo per cui qui dentro c'e la
 * carriera al Foggia e non la carriera intera: quello che si vede e quello
 * che si e potuto leggere senza forzare niente.
 *
 * PERCHE SI CERCA PER NOME
 *
 * L'identificativo di Transfermarkt e nel file, ma la rosa dell'app viene da
 * Wikipedia e quell'identificativo non ce l'ha. Il nome completo normalizzato
 * aggancia tutti e 26 i giocatori della rosa attuale; se un giorno ne manca
 * uno, il posto giusto dove sistemarlo e questo, non la schermata.
 */

export type StagioneCarriera = {
  /** "2016-17" */
  s: string;
  p: number;
  g: number;
  m: number;
};

export type Carriera = {
  idTm: string | null;
  nome: string;
  ruolo: string;
  presenze: number;
  gol: number;
  minuti: number;
  stagioni: StagioneCarriera[];
};

export type Anagrafica = {
  idTm: string;
  nome: string;
  ruolo: string;
  nato: string | null;
  altezza: string | null;
  piede: string | null;
  arrivatoDa: string | null;
  arrivatoIl: string | null;
  contratto: string | null;
};

export type Archivio = {
  fonte: string;
  presoIl: string;
  copre: string;
  rosaAttuale: Anagrafica[];
  giocatori: Carriera[];
};

export function normalizzaNome(nome: string): string {
  return String(nome ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/**
 * "11 settembre 2026".
 *
 * Con l'anno, al contrario delle date delle partite: questa dice quanto e
 * vecchio il dato, e fra due stagioni la differenza si deve vedere.
 */
export function dataLeggibile(iso: string): string {
  const [anno, mese, giorno] = iso.split('-').map(Number);
  if (!anno || !mese || !giorno) return iso;
  return `${giorno} ${MESI[mese - 1]} ${anno}`;
}

/** Quanti minuti a partita, per capire se era titolare. Null sotto le 5 partite. */
export function minutiAPartita(c: Carriera): number | null {
  if (c.presenze < 5) return null;
  return Math.round(c.minuti / c.presenze);
}

/**
 * Prepara le ricerche per nome.
 *
 * L'archivio arriva da fuori invece di essere importato qui: cosi questo file
 * resta senza dati e si puo provare, come gli altri *-core.
 */
export function indicizza(dati: Archivio) {
  const carriere = new Map<string, Carriera>();
  for (const g of dati.giocatori) {
    const chiave = normalizzaNome(g.nome);
    // il primo vince: l'archivio e ordinato per presenze, quindi in caso di
    // omonimia resta quello che al Foggia ha giocato di piu
    if (!carriere.has(chiave)) carriere.set(chiave, g);
  }

  const anagrafiche = new Map<string, Anagrafica>();
  for (const a of dati.rosaAttuale) anagrafiche.set(normalizzaNome(a.nome), a);

  return {
    fonte: {
      nome: 'Transfermarkt',
      presoIl: dati.presoIl,
      presoIlLeggibile: dataLeggibile(dati.presoIl),
      copre: dati.copre,
    },
    /** La carriera al Foggia di chi ha giocato almeno una partita. Altrimenti null. */
    carrieraDi: (nome: string): Carriera | null => carriere.get(normalizzaNome(nome)) ?? null,
    /** Altezza, piede, da dove e arrivato: solo per chi e in rosa adesso. */
    anagraficaDi: (nome: string): Anagrafica | null => anagrafiche.get(normalizzaNome(nome)) ?? null,
    /** I piu presenti di sempre, per le schede storiche. */
    piuPresenti: (quanti = 20): Carriera[] => dati.giocatori.slice(0, quanti),
  };
}
