/**
 * Le formazioni dalla diretta scritta di calciofoggia.it.
 *
 * PERCHE ESISTE
 *
 * Le formazioni ufficiali dalla Lega arrivano quando la Lega apre la partita,
 * cioe al calcio d'inizio: il 15 settembre nell'app sono comparse con
 * cinquanta minuti di ritardo. Le testate che seguono il Foggia le pubblicano
 * appena le riceve la sala stampa, quasi un'ora prima.
 *
 * COME
 *
 * calciofoggia.it e una delle testate gia in rassegna stampa, ed e WordPress:
 * l'elenco degli articoli si legge con una chiamata sola, senza scaricare
 * pagine intere. Un'ora prima del fischio pubblicano un pezzo unico che poi
 * aggiornano per tutta la partita -- prepartita, formazioni, minuto per
 * minuto. Da li si prendono due cose che nessuna fonte dal vivo da: l'undici
 * ufficiale e i minuti di recupero.
 *
 * Si legge il testo pubblicato e si cita la fonte nell'app. Niente altro.
 */
import type { ColonnaLega, FormazioniLega } from './legapro.ts';

/**
 * Le testate che seguono il Foggia e pubblicano la diretta scritta.
 *
 * Due, non una: la prima che ha le formazioni vince. Se una sera una pubblica
 * tardi, o cambia il modo di scrivere il tabellino, l'altra copre -- e chi
 * guarda non se ne accorge. Sono le stesse gia in rassegna stampa, e nell'app
 * la formazione porta scritto da dove viene.
 */
export const TESTATE = [
  { nome: 'calciofoggia.it', api: 'https://www.calciofoggia.it/wp-json/wp/v2/posts' },
  { nome: 'foggiacalciomania.com', api: 'https://foggiacalciomania.com/wp-json/wp/v2/posts' },
] as const;

const UA = 'daunia-app/1.0 (app tifosi non ufficiale)';

export type DirettaWeb = {
  /** quale testata, come indice in TESTATE: serve per rileggere lo stesso articolo */
  testata: number;
  id: number;
  titolo: string;
  contenuto: string;
};

export const nomeTestata = (i: number): string => TESTATE[i]?.nome ?? TESTATE[0].nome;

const entita = (s: string) => s
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#0?39;|&#8217;|&#8216;/g, "'")
  .replace(/&#8211;|&#8212;/g, '-')
  .replace(/&#8242;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Il testo in righe: i ritorni a capo della diretta sono `<br>`, non `\n`. */
export function righe(html: string): string[] {
  return entita(String(html ?? ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|div)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((r) => r.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const pulisci = (s: unknown) => String(s ?? '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

const combacia = (a: unknown, b: unknown) => {
  const [x, y] = [pulisci(a), pulisci(b)];
  return Boolean(x) && Boolean(y) && (x.includes(y) || y.includes(x));
};

/**
 * Le formazioni dentro la diretta scritta.
 *
 * Il blocco e sempre fatto cosi: un titolo "Formazioni ufficiali", poi una
 * riga per squadra ("Foggia: Saro, Todisco, ...") e sotto l'allenatore. Il
 * modulo fra parentesi c'e solo a volte.
 *
 * Torna null quando il blocco non c'e ancora: e la differenza fra "non le
 * hanno ancora pubblicate" e "il parser si e rotto", e nell'ora prima del
 * fischio e l'unica cosa che conta sapere.
 */
export function formazioniDaDiretta(
  html: string | null,
  casa?: string | null,
  ospiti?: string | null,
): FormazioniLega | null {
  if (!html) return null;
  const tutte = righe(html);
  /*
   * Ogni testata le scrive a modo suo.
   *
   * Una mette un titolo "Formazioni ufficiali" e sotto le due righe; un'altra
   * non mette nessun titolo e le infila nel tabellino, in mezzo ad arbitro,
   * ammoniti e panchina. Quindi: se il titolo c'e si parte da li, altrimenti
   * si guarda tutto e si tengono le righe che sono davvero una formazione,
   * cioe quelle con undici nomi.
   */
  const inizio = tutte.findIndex((r) => /^formazioni ufficiali/i.test(r));
  const conTitolo = inizio >= 0;

  const colonne: ColonnaLega[] = [];
  for (const riga of tutte.slice(conTitolo ? inizio + 1 : 0)) {
    // col titolo il blocco finisce al titolo dopo: "Prepartita", "Tabellino"
    if (conTitolo && colonne.length >= 2 && !/^all\.?:/i.test(riga)) break;
    if (conTitolo && /^(prepartita|tabellino|arbitro|precedenti)\b/i.test(riga)) break;

    const allenatore = riga.match(/^all(?:enatore)?\.?:\s*(.+)$/i);
    if (allenatore && colonne.length) {
      colonne[colonne.length - 1].allenatore = allenatore[1].trim() || null;
      continue;
    }

    const squadra = riga.match(/^([A-Za-zÀ-ÿ'.\s]{3,30}?)\s*(?:\(([\d-]+)\))?\s*:\s*(.+)$/);
    if (!squadra) continue;
    /*
     * Nel tabellino la panchina e fatta come una formazione: stessa riga,
     * stessi nomi separati da virgola, spesso anche piu di undici. Senza
     * questo elenco la panchina del Foggia finiva sotto lo stemma del Savoia.
     */
    if (/^(a disposizione|disposizione|panchina|arbitro|assistent|quarto|note|ammonit|espuls|marcator|reti|rete|recupero|operatore)/i
      .test(squadra[1].trim())) continue;
    const giocatori = squadra[3]
      .split(/[,;]/)
      .map((n) => n.replace(/\(.*?\)/g, '').replace(/^\d+\s*/, '').trim())
      .filter((n) => n.length > 1 && /[A-Za-zÀ-ÿ]/.test(n))
      .map((nome) => ({ numero: null, nome, ruolo: null }));
    // meno di undici nomi non e una formazione: e una frase che finisce con i due punti
    if (giocatori.length < 11) continue;
    colonne.push({
      squadra: squadra[1].trim(),
      modulo: squadra[2] ?? null,
      allenatore: null,
      giocatori: giocatori.slice(0, 11),
    });
  }

  if (colonne.length < 2) return null;

  /*
   * Chi e in casa lo dice la partita, non l'ordine dell'articolo.
   *
   * La diretta mette quasi sempre prima i padroni di casa, ma "quasi sempre"
   * in una formazione vuol dire mostrare l'undici sbagliato sotto lo stemma
   * sbagliato. Se i nomi combaciano si usa quello; se non combaciano nessuno
   * dei due, si tiene l'ordine dell'articolo.
   */
  const perNome = casa && ospiti
    ? [colonne.find((c) => combacia(c.squadra, casa)), colonne.find((c) => combacia(c.squadra, ospiti))]
    : [];
  if (perNome[0] && perNome[1] && perNome[0] !== perNome[1]) {
    return { casa: perNome[0], ospiti: perNome[1] };
  }
  return { casa: colonne[0], ospiti: colonne[1] };
}

const NUMERI: Record<string, number> = {
  uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
};

/**
 * I minuti di recupero annunciati, presi dalla diretta scritta.
 *
 * Nessuna fonte dal vivo li pubblica: ne TheSportsDB ne live-score-api hanno
 * un campo per il recupero. La diretta lo dice appena il quarto uomo alza il
 * cartello ("45' - Tre minuti di recupero"), e per chi guarda la partita e la
 * differenza fra "sta per finire" e "c'e ancora tempo".
 *
 * Con `stato` si prende quello del tempo che si sta giocando: a meta ripresa
 * il cartello del primo tempo non vuol dire piu niente, e lasciarlo scritto
 * sarebbe peggio che non averlo.
 */
export function recuperoDaDiretta(
  html: string | null,
  stato?: string | null,
): { minuto: number; minuti: number } | null {
  if (!html) return null;
  const trovati: Array<{ minuto: number; minuti: number }> = [];

  for (const riga of righe(html)) {
    if (!/recupero/i.test(riga)) continue;
    const quando = riga.match(/^(\d{1,3})\s*['’′]/);
    // il minuto della riga si toglie prima di cercare i minuti di recupero:
    // in "90' - Cinque minuti" il primo numero che si incontra e il novanta
    const dopo = riga.replace(/^\d{1,3}\s*['’′]?\s*[-–—]*\s*/, '');
    const quanti = dopo.match(/(\d{1,2}|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s*(?:'|minut)/i);
    if (!quando || !quanti) continue;
    const minuti = Number(quanti[1]) || NUMERI[quanti[1].toLowerCase()] || 0;
    if (!minuti || minuti > 30) continue;
    trovati.push({ minuto: Number(quando[1]), minuti });
  }
  if (!trovati.length) return null;

  /*
   * La finestra del tempo in corso: il cartello si alza a fine tempo.
   *
   * Fuori dai tempi di gioco -- all'intervallo, a partita finita -- non c'e
   * nessun recupero in corso, e tenere scritto quello di prima e peggio che
   * non averlo.
   */
  const finestre: Record<string, [number, number]> = { '1H': [35, 55], '2H': [80, 120], ET: [100, 140] };
  let buoni = trovati;
  if (stato !== undefined && stato !== null) {
    const dentro = finestre[stato];
    if (!dentro) return null;
    buoni = trovati.filter((r) => r.minuto >= dentro[0] && r.minuto <= dentro[1]);
  }
  if (!buoni.length) return null;
  // l'annuncio piu avanti nella partita e quello che vale adesso
  return buoni.reduce((a, b) => (b.minuto > a.minuto ? b : a));
}

/**
 * L'articolo della diretta di questa partita, se e gia stato pubblicato.
 *
 * Si cercano gli articoli usciti da qualche ora prima del fischio in poi e si
 * tiene quello che ha in testa i nomi delle due squadre. Senza finestra si
 * prenderebbe la diretta della settimana scorsa.
 */
export async function trovaDiretta(
  casa: string,
  ospiti: string,
  kickoff: number,
  prendi: (url: string) => Promise<unknown> = chiedi,
): Promise<DirettaWeb | null> {
  const da = new Date(kickoff - 6 * 60 * 60 * 1000).toISOString().slice(0, 19);
  const a = new Date(kickoff + 4 * 60 * 60 * 1000).toISOString().slice(0, 19);

  for (let t = 0; t < TESTATE.length; t += 1) {
    /*
     * Solo id e titolo: gli articoli della diretta pesano dieci chilobyte
     * ciascuno, e chiederne venti interi per leggerne uno sarebbe scortese
     * verso un sito che non ci deve niente. Il testo si prende dopo, uno solo.
     */
    const d = await prendi(
      `${TESTATE[t].api}?per_page=20&orderby=date&order=desc&after=${da}&before=${a}&_fields=id,title`,
    );
    const elenco = Array.isArray(d) ? d as Array<Record<string, unknown>> : [];

    const nostri = elenco
      .map((p) => ({
        id: Number(p.id),
        titolo: entita(String((p?.title as { rendered?: string } | undefined)?.rendered ?? ''))
          .replace(/<[^>]*>/g, ''),
      }))
      .filter((p) => combacia(p.titolo.split(/[-–]/)[0], casa)
        && new RegExp(pulisci(ospiti), 'i').test(pulisci(p.titolo)));
    if (!nostri.length) continue;

    /*
     * Fra gli articoli sulla partita si preferisce quello della diretta.
     *
     * Nel pomeriggio ne escono altri che nominano le stesse due squadre -- i
     * convocati, la presentazione -- e dentro non hanno nessuna formazione:
     * prendendo il primo si finirebbe a rileggere per due ore un pezzo che non
     * cambia mai.
     */
    const scelto = nostri.find((p) => /diretta|live|cronaca|minuto per minuto/i.test(p.titolo))
      ?? nostri[0];
    const uno = await leggiDiretta(t, scelto.id, prendi);
    if (uno) return uno;
  }
  return null;
}

/**
 * La diretta gia trovata, riletta per id.
 *
 * Durante la partita si rilegge lo stesso articolo ogni pochi minuti: cercarlo
 * ogni volta nell'elenco sarebbe una chiamata in piu ogni volta, per sapere
 * una cosa che si sa gia.
 */
export async function leggiDiretta(
  testata: number,
  id: number | string,
  prendi: (url: string) => Promise<unknown> = chiedi,
): Promise<DirettaWeb | null> {
  const api = TESTATE[testata]?.api;
  if (!api) return null;
  const d = await prendi(`${api}/${id}?_fields=id,title,content`) as Record<string, unknown> | null;
  if (!d || !d.id) return null;
  const titoli = d.title as { rendered?: string } | undefined;
  const testo = d.content as { rendered?: string } | undefined;
  return {
    testata,
    id: Number(d.id),
    titolo: entita(String(titoli?.rendered ?? '')).replace(/<[^>]*>/g, ''),
    contenuto: String(testo?.rendered ?? ''),
  };
}

async function chiedi(url: string): Promise<unknown> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
