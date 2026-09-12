/**
 * Le partite che non si giocano dove dice il calendario.
 *
 * PERCHE ESISTE
 *
 * Il 12 settembre 2026 l'app mandava i tifosi a Monopoli, allo stadio
 * Veneziani. La partita si giocava al San Nicola di Bari, cinquanta chilometri
 * piu in la. Lo dicevano tre articoli di due testate diverse; il calendario di
 * Wikipedia, no.
 *
 * Non e un caso raro. In Serie C una gara si sposta per lavori, per capienza o
 * per un'ordinanza, e la pagina di Wikipedia porta il campo di casa della
 * squadra, che e giusto in generale e sbagliato quel giorno. Per un'app di
 * tifosi mandare qualcuno allo stadio sbagliato e il difetto peggiore che ci
 * sia: non e un numero storto, e un pomeriggio buttato e settanta euro di
 * benzina.
 *
 * COME SI USA
 *
 * Si aggiunge una riga a `campi-spostati.json` e basta -- non serve toccare
 * codice. La riga vale per UNA data e UNA coppia di squadre, cosi non puo
 * restare accesa per sbaglio sulle giornate successive.
 *
 * Perche a mano e non automatico: leggere lo spostamento dalla prosa dei
 * giornali con delle espressioni regolari sbaglierebbe, e sbaglierebbe proprio
 * qui, dove sbagliare costa piu che non sapere.
 */

/** Confronto fra nomi di squadra: senza accenti, senza punteggiatura, minuscolo. */
function chiave(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Il nome della squadra, comunque sia scritto in quel punto della catena.
 *
 * Serve perche la partita cambia forma strada facendo: appena uscita da
 * Wikipedia ha `homeName`/`awayName`, due stringhe; dopo `normalize()` ha
 * `home`/`away`, due oggetti squadra. La prima versione leggeva solo la
 * seconda forma, e siccome gli spostamenti si applicano PRIMA di normalize
 * non trovava mai niente -- falliva in silenzio, con un avviso che diceva
 * "la riga si puo togliere" mentre la riga era giusta.
 */
function nomeDi(partita, lato) {
  const diretto = partita?.[lato];
  if (typeof diretto === 'string') return diretto;
  if (diretto && typeof diretto === 'object') return diretto.shortName || diretto.name || '';
  const grezzo = partita?.[`${lato}Name`];
  return typeof grezzo === 'string' ? grezzo : '';
}

/** Il giorno della partita in ora italiana, non UTC. */
function giornoItaliano(iso) {
  const t = Date.parse(iso ?? '');
  if (Number.isNaN(t)) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(t));
}

/**
 * Applica gli spostamenti alle partite. Modifica in loco e restituisce gli
 * avvisi, uno per riga applicata e uno per riga che non ha trovato la partita.
 *
 * Una riga che non combacia e' un avviso, non un errore: quasi sempre vuol
 * dire che la partita e' passata e la riga si puo togliere.
 */
export function applicaCampiSpostati(partite, righe) {
  const avvisi = [];
  if (!Array.isArray(partite) || !Array.isArray(righe)) return avvisi;

  for (const riga of righe) {
    if (!riga?.quando || !riga?.campo) continue;

    const casa = chiave(riga.casa);
    const ospite = chiave(riga.ospite);

    const trovate = partite.filter((p) =>
      giornoItaliano(p.kickoff || p.date) === riga.quando
      && (!casa || chiave(nomeDi(p, 'home')) === casa)
      && (!ospite || chiave(nomeDi(p, 'away')) === ospite));

    if (!trovate.length) {
      avvisi.push(`Campo spostato ${riga.quando} ${riga.casa}-${riga.ospite}: nessuna partita corrisponde, la riga si puo togliere.`);
      continue;
    }

    for (const p of trovate) {
      const prima = p.venue;
      p.venue = riga.campo;
      if (riga.citta) p.city = riga.citta;
      p.campoSpostato = {
        eraPrevisto: prima ?? null,
        perche: riga.perche ?? null,
        fonti: Array.isArray(riga.fonti) ? riga.fonti : [],
      };
      avvisi.push(`Campo spostato ${riga.quando} ${riga.casa}-${riga.ospite}: da "${prima ?? 'sconosciuto'}" a "${riga.campo}".`);
    }
  }

  return avvisi;
}
