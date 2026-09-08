/**
 * Rassegna stampa: gli articoli delle testate che hanno detto di si.
 *
 * COSA ENTRA E COSA NO
 *
 * Titolo, link, data e il sommario che il feed espone gia da solo. Il corpo no,
 * nemmeno quando il feed lo porta per intero, che e il caso piu comune. La
 * differenza fra una vetrina e una copia sta tutta li, ed e la promessa scritta
 * nella mail con cui le redazioni sono state contattate.
 *
 * Chi tocca un articolo finisce sulla pagina della testata, aperta col browser
 * di sistema: la loro pubblicita e i loro cookie girano come sul sito. Le visite
 * restano loro, ed e la ragione per cui accettano.
 *
 * QUANTO SPESSO SI GUARDA
 *
 * Due volte al giorno. Il workflow gira ogni mezz'ora per altri motivi e in CI
 * la cache su disco e spenta, quindi il freno non puo stare ne nel cron ne nella
 * cache: sta nel dato. `data/stampa.json` si porta dietro l'ora dell'ultimo giro
 * e finche e giovane si riusa com'e, senza una richiesta.
 *
 * L'IMMAGINE
 *
 * Il feed non la porta. Sta nell'`og:image` della pagina dell'articolo, che
 * costa una richiesta a pezzo -- pagata una volta sola, perche un articolo gia
 * conosciuto si ricicla dal giro precedente. L'indirizzo e loro e resta loro:
 * qui non si copia nessun file.
 *
 * SPEGNERE UNA TESTATA
 *
 * `attiva: false` e al giro successivo sparisce. Deve restare una riga sola,
 * perche nella mail c'e scritto "vi tolgo in giornata" e quella frase va
 * mantenuta senza dover riscrivere niente.
 *
 * IL DIFETTO CHE SI PORTA DIETRO
 *
 * Un feed che smette di rispondere non fa rumore: la sezione resta com'era e
 * sembra solo che nessuno abbia scritto niente. Per questo un feed muto o
 * vuoto finisce fra gli avvisi dell'ingest.
 */
import { createHash } from 'node:crypto';

import { getTesto, stripHtml, decodeEntities, sleep } from '../util.mjs';

const ORE = 60 * 60 * 1000;

/** Quanti articoli si tengono per testata. Oltre, e archivio che nessuno apre. */
const PER_TESTATA = 10;

/** Ogni quanto si torna a guardare i feed. Due volte al giorno. */
export const SOGLIA = 12 * 60 * 60 * 1000;

/**
 * Quante immagini si cercano in un giro solo.
 *
 * Ognuna costa la lettura di una pagina. Alla prima accensione sono dieci, poi
 * due o tre al giorno: gli articoli gia visti si portano dietro la loro. Il
 * tetto serve al giorno in cui si accendono cinque testate insieme.
 */
const IMMAGINI_PER_GIRO = 15;

/** Respiro fra una pagina e l'altra: non siamo l'unico visitatore del sito. */
const PAUSA = 400;

/** Lunghezza del sommario. Corto per scelta, non per pigrizia: vedi sopra. */
const SOMMARIO_MAX = 180;

/**
 * Le testate. Una riga per ognuna, con la data del permesso accanto.
 *
 * `filtro` serve alle testate generaliste, che pubblicano anche cronaca e
 * politica: senza, la sezione si riempie di roba che non c'entra col Foggia.
 * Chi parla solo di Foggia ha `filtro: null`.
 */
export const TESTATE = [
  {
    id: 'calciofoggia',
    nome: 'CalcioFoggia.it',
    motto: 'Tutto il calcio della Capitanata',
    sito: 'https://www.calciofoggia.it',
    feed: 'https://www.calciofoggia.it/feed/',
    // "black" nel nome del file vuol dire "per fondi neri": e la versione a
    // inchiostro chiaro. Quella scura e logo400.png, e su fondo nero sparisce.
    logo: 'https://www.calciofoggia.it/wp-content/uploads/2025/02/logo-black400.png',
    logoSuChiaro: false,
    permesso: '2026-09-08',
    attiva: true,
    filtro: null,
  },
  {
    id: 'foggiacalciomania',
    nome: 'Foggiacalciomania',
    motto: 'Il portale dei satanelli',
    sito: 'https://foggiacalciomania.com',
    feed: 'https://foggiacalciomania.com/feed/',
    // le lettere sono scure, ma hanno un contorno bianco spesso che le stacca
    // dal fondo: sul nero si legge, e la piastra chiara qui non serve
    logo: 'https://foggiacalciomania.com/wp-content/uploads/2014/09/logo1.png',
    logoSuChiaro: false,
    permesso: '2026-09-08',
    attiva: true,
    filtro: null,
  },
  {
    id: 'ilfoggia',
    nome: 'ilFoggia.com',
    motto: 'Quotidiano online sul Foggia Calcio',
    sito: 'https://www.ilfoggia.com',
    feed: 'https://www.ilfoggia.com/feed/',
    // e una fascia larga col fondo nero e rosso gia dentro l'immagine: sulla
    // piastra scura si posa senza stonare, su quella bianca sarebbe un blocco
    logo: 'https://www.ilfoggia.com/wp-content/uploads/2020/11/ilfoggia.banner-nuovo.jpg',
    logoSuChiaro: false,
    permesso: '2026-09-08',
    attiva: true,
    filtro: null,
  },
];

/** Parole che rendono un articolo di una testata generalista roba nostra. */
export const FILTRO_FOGGIA = /\bfoggia\b|\bsatanell|\bzaccheria\b|\brossoner|\bcapitanata\b/i;

/**
 * Legge un RSS senza librerie. Servono cinque campi, non un parser vero.
 *
 * Il CDATA si toglie prima di ripulire l'HTML: al contrario restavano dentro i
 * marcatori e finivano nel titolo.
 */
export function leggiVoci(xml) {
  const voci = [];
  for (const blocco of String(xml).split(/<item[\s>]/i).slice(1)) {
    const grezzo = (tag) => {
      const m = blocco.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') : '';
    };
    const pulito = (tag) => decodeEntities(stripHtml(grezzo(tag))).replace(/\s+/g, ' ').trim();

    const titolo = pulito('title');
    const link = pulito('link');
    if (!titolo || !link) continue;

    voci.push({
      titolo,
      link,
      data: grezzo('pubDate').trim(),
      sommario: pulito('description'),
      autore: pulito('dc:creator') || null,
      categoria: pulito('category') || null,
    });
  }
  return voci;
}

/** Taglia sull'ultimo spazio utile, cosi non si spezzano le parole a meta. */
export function accorcia(testo, max = SOMMARIO_MAX) {
  const s = String(testo ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const tagliato = s.slice(0, max);
  const spazio = tagliato.lastIndexOf(' ');
  return `${(spazio > max * 0.6 ? tagliato.slice(0, spazio) : tagliato).replace(/[.,;:\-–—]$/, '')}…`;
}

/** Una data RSS che non si capisce vale null: meglio niente di una data finta. */
export function quando(pubDate) {
  const t = Date.parse(pubDate);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * Identita stabile dell'articolo.
 *
 * Impronta del link intero, non un pezzo di URL: due titoli lunghi che finiscono
 * allo stesso modo darebbero lo stesso id, e in una lista sparirebbe uno dei due.
 */
export function idArticolo(testata, link) {
  return `${testata}-${createHash('sha1').update(String(link)).digest('hex').slice(0, 10)}`;
}

/**
 * L'immagine di copertina dichiarata dalla pagina.
 *
 * `og:image` e quella che la testata mette quando il pezzo viene condiviso:
 * e una scelta della redazione, non una foto pescata dentro il corpo. Se non
 * c'e resta null e la scheda si disegna senza — mai una immagine scelta da noi
 * al posto della loro.
 */
export function immagineDa(html) {
  const s = String(html ?? '');
  for (const chiave of ['og:image', 'twitter:image']) {
    const m = s.match(new RegExp(`<meta[^>]+(?:property|name)=["']${chiave}["'][^>]*content=["']([^"']+)["']`, 'i'))
      ?? s.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${chiave}["']`, 'i'));
    if (m && /^https?:\/\//i.test(m[1])) return decodeEntities(m[1]);
  }
  return null;
}

/** Converte una voce del feed in un articolo, o null se non tiene. */
export function articolo(testata, voce, immagine = null) {
  const data = quando(voce.data);
  if (!data) return null;
  if (testata.filtro && !testata.filtro.test(`${voce.titolo} ${voce.sommario}`)) return null;

  return {
    id: idArticolo(testata.id, voce.link),
    testata: testata.id,
    titolo: voce.titolo,
    sommario: accorcia(voce.sommario),
    url: voce.link,
    data,
    autore: voce.autore,
    categoria: voce.categoria,
    immagine,
  };
}

/**
 * Dice se conviene ripassare dai feed.
 *
 * Il giro precedente arriva da `data/stampa.json`, che sta nel repository: e
 * l'unica memoria che sopravvive a una macchina di CI pulita, dove la cache su
 * disco e spenta e ogni esecuzione parte da zero.
 */
export function daRifare(precedente, adesso = Date.now(), soglia = SOGLIA) {
  const t = Date.parse(precedente?.aggiornatoIl ?? '');
  if (!Number.isFinite(t)) return true;
  if (!precedente?.articoli?.length) return true;
  return adesso - t >= soglia;
}

/**
 * Scarica la rassegna. Torna anche le testate, perche l'app ne disegna il
 * banner e non deve conoscere questa lista per conto suo.
 *
 * `precedente` e il contenuto di `data/stampa.json` del giro prima. Serve a due
 * cose: saltare del tutto il lavoro se e ancora fresco, e ricordare le immagini
 * gia trovate, cosi la pagina di un articolo si scarica una volta e basta.
 */
export async function fetchStampa({ precedente = null, adesso = Date.now(), ttl = 2 * ORE } = {}) {
  const attive = TESTATE.filter((t) => t.attiva);

  const testate = attive.map(({ id, nome, motto, sito, logo, logoSuChiaro }) => ({
    id, nome, motto, sito, logo, logoSuChiaro: Boolean(logoSuChiaro),
  }));

  if (!daRifare(precedente, adesso)) {
    return { ...precedente, testate, warnings: [], saltato: true };
  }

  // le immagini gia note: un articolo visto ieri non si riapre oggi
  const immaginiNote = new Map(
    (precedente?.articoli ?? []).filter((a) => a.immagine).map((a) => [a.id, a.immagine]),
  );

  const warnings = [];
  const articoli = [];
  let cercate = 0;

  for (const t of attive) {
    try {
      const voci = leggiVoci(await getTesto(t.feed, { ttl }));
      if (!voci.length) {
        warnings.push(`Stampa, ${t.nome}: il feed risponde ma non contiene articoli.`);
        continue;
      }

      const suoi = voci
        .map((v) => ({ v, a: articolo(t, v, immaginiNote.get(idArticolo(t.id, v.link)) ?? null) }))
        .filter((x) => x.a)
        .sort((x, y) => y.a.data.localeCompare(x.a.data))
        .slice(0, PER_TESTATA);

      if (!suoi.length) warnings.push(`Stampa, ${t.nome}: ${voci.length} voci lette, nessuna passa il filtro.`);

      for (const { v, a } of suoi) {
        if (!a.immagine && cercate < IMMAGINI_PER_GIRO) {
          cercate += 1;
          try {
            // una pagina alla volta, con un respiro: non siamo l'unico visitatore
            if (cercate > 1) await sleep(PAUSA);
            a.immagine = immagineDa(await getTesto(v.link, { ttl }));
          } catch {
            // la copertina non vale un giro fallito: l'articolo resta, senza foto
          }
        }
        articoli.push(a);
      }
    } catch (err) {
      warnings.push(`Stampa, ${t.nome}: ${err.message}`);
    }
  }

  /*
   * Se il giro non ha portato niente ma prima c'era qualcosa, si tiene il
   * vecchio. Una sezione che si svuota da sola per un feed giu per dieci minuti
   * e peggio di una sezione con gli articoli di stamattina.
   */
  if (!articoli.length && precedente?.articoli?.length) {
    warnings.push('Stampa: nessun articolo da nessuna testata, si tiene il giro precedente.');
    return { ...precedente, testate, warnings, saltato: false };
  }

  return {
    testate,
    articoli: articoli.sort((a, b) => b.data.localeCompare(a.data)),
    aggiornatoIl: new Date(adesso).toISOString(),
    warnings,
    saltato: false,
  };
}
