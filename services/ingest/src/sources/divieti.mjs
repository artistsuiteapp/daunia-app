/**
 * Divieti di trasferta, letti dalla stampa locale.
 *
 * COSA FA E COSA NON FA
 *
 * Propone. Non pubblica. La differenza non e formale: un divieto sbagliato fa
 * prendere un treno a vuoto a qualcuno, ed e l'unico punto di questo progetto
 * in cui un errore del programma costa soldi a una persona. Quindi il file che
 * esce da qui e una proposta, e diventa vera solo dopo che una persona l'ha
 * letta e confermata.
 *
 * IL DIFETTO CHE SI PORTA DIETRO
 *
 * Riconosce delle formule ricorrenti. Il giorno che i giornalisti cambiano modo
 * di scrivere, smette di funzionare e non se ne accorge nessuno. Per questo
 * l'ingest segnala anche il proprio silenzio: se manca meno di una settimana a
 * una trasferta e qui non e uscito niente, e un avviso, non una notizia.
 *
 * Il divieto colpisce i RESIDENTI nella provincia, salvo Tessera del tifoso.
 * Non e un dettaglio: e la ragione per cui la sezione serve a chi vive fuori.
 */
import { getTesto, stripHtml } from '../util.mjs';

const ORE = 60 * 60 * 1000;

/** Le fonti locali che coprono queste decisioni. Sono RSS pubblici. */
export const FONTI = [
  { nome: 'FoggiaToday', url: 'https://www.foggiatoday.it/rss' },
  { nome: 'Statoquotidiano', url: 'https://www.statoquotidiano.it/feed/' },
];

/*
 * Le formule. L'ordine conta: la piu specifica vince, perche un articolo che
 * parla di settore ospiti chiuso spesso contiene anche "trasferta vietata".
 */
const REGOLE = [
  { stato: 'ospiti-chiuso', spie: [
    /settore\s+ospiti\s+(chiuso|non\s+sara\s+aperto)/i,
    /senza\s+tifosi\s+ospiti/i,
    /porte\s+chiuse\s+(per\s+i\s+)?tifosi\s+ospiti/i,
  ] },
  { stato: 'vietata-residenti', spie: [
    /vietat\w*\s+la\s+vendita\s+dei\s+biglietti\s+ai\s+residenti/i,
    /divieto\s+di\s+vendita[^.]{0,60}residenti/i,
    /trasfert\w+\s+vietat\w+/i,
    /vietat\w+\s+la\s+trasfert\w+/i,
  ] },
  { stato: 'aperta', spie: [
    /trasfert\w+\s+(consentit\w+|liber\w+|autorizzat\w+)/i,
    /nessuna\s+limitazione[^.]{0,40}tifosi/i,
  ] },
];

/** Legge un RSS senza librerie: qui servono tre campi, non un parser vero. */
async function leggiFeed(url) {
  const testo = await getTesto(url, { ttl: 2 * ORE });
  const voci = [];
  for (const blocco of String(testo).split(/<item[\s>]/i).slice(1)) {
    const campo = (tag) => {
      const m = blocco.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      if (!m) return '';
      return stripHtml(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
    };
    const titolo = campo('title');
    if (!titolo) continue;
    voci.push({ titolo, link: campo('link'), testo: `${titolo} ${campo('description')}` });
  }
  return voci;
}

export function classifica(testo) {
  for (const r of REGOLE) {
    for (const spia of r.spie) if (spia.test(testo)) return { stato: r.stato, spia: String(spia) };
  }
  return null;
}

/**
 * Nome confrontabile: "SS MONOPOLI 1966" e "monopoli" devono incontrarsi.
 *
 * L'ordine dei passaggi conta. Prima si riduce tutto a lettere e spazi, poi si
 * buttano le sigle: al contrario "A.C. Trapani" restava "a c trapani", perche
 * i punti tenevano insieme la sigla e la regola non la riconosceva.
 */
const RUMORE = new Set([
  'ssc', 'ss', 'us', 'usd', 'asd', 'ssd', 'ac', 'acd', 'fc', 'sc', 'bc',
  'spa', 'srl', 'calcio', 'football', 'club', 'societa', 'sportiva',
  'a', 'c', 's', 'u', 'ii',
]);

export function chiave(nome) {
  return String(nome ?? '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]+/g, ' ')
    .split(' ')
    .filter((x) => x && !RUMORE.has(x))
    .join(' ');
}

/**
 * Cerca nella stampa i provvedimenti sulle prossime trasferte.
 *
 * `partite` sono le gare fuori casa non ancora giocate. Torna una proposta per
 * ognuna che compare in un articolo riconosciuto, piu gli avvisi.
 */
export async function fetchDivieti({ partite, adesso = Date.now() }) {
  const avvisi = [];
  const voci = [];

  for (const f of FONTI) {
    try {
      for (const v of await leggiFeed(f.url)) voci.push({ ...v, fonte: f.nome });
    } catch (err) {
      avvisi.push(`Divieti, ${f.nome}: ${err.message}`);
    }
  }

  const proposte = {};
  for (const v of voci) {
    const esito = classifica(v.testo);
    if (!esito) continue;

    const testoChiave = chiave(v.testo);
    for (const p of partite) {
      const avversario = chiave(p.away);
      // parole di almeno quattro lettere: "bari" si, "az" no, altrimenti
      // qualsiasi articolo aggancerebbe qualsiasi squadra
      const parti = avversario.split(' ').filter((x) => x.length >= 4);
      if (!parti.length || !parti.some((x) => testoChiave.includes(x))) continue;

      // la prima notizia buona vince: le successive di solito la ripetono
      if (proposte[p.id]) continue;
      proposte[p.id] = {
        partita: p.id,
        avversario: p.away,
        kickoff: p.kickoff,
        stato: esito.stato,
        fonte_nome: v.fonte,
        fonte_url: v.link,
        titolo: v.titolo,
        riconosciuto: esito.spia,
        propostoIl: new Date(adesso).toISOString(),
      };
    }
  }

  /*
   * Il silenzio va segnalato. Se manca poco a una trasferta e non e uscito
   * niente, non vuol dire che sia tutto aperto: vuol dire che non lo sappiamo,
   * e forse il riconoscimento si e rotto.
   */
  const SETTE_GIORNI = 7 * 24 * ORE;
  for (const p of partite) {
    const t = Date.parse(p.kickoff);
    if (!Number.isFinite(t) || t < adesso || t - adesso > SETTE_GIORNI) continue;
    if (proposte[p.id]) continue;
    avvisi.push(
      `Trasferta a ${p.away} fra meno di una settimana e nessuna notizia sul divieto: `
      + 'controlla a mano, potrebbe essersi rotto il riconoscimento.',
    );
  }

  return { proposte: Object.values(proposte), warnings: avvisi };
}
