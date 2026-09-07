/**
 * Le formazioni ufficiali, dal sito della Lega.
 *
 * seriec.com e il sito ufficiale della Serie C, e il suo robots.txt consente
 * tutti i bot -- le uniche esclusioni nominate sono i crawler di addestramento
 * AI. Quello che leggiamo qui e' quello che il sito dice di poter leggere.
 *
 * Non e' scraping di una pagina: il calendario ha un endpoint AJAX (October
 * CMS) con un id per partita, e risponde con un pezzo di HTML strutturato. Un
 * id opaco e' molto piu' stabile di un selettore CSS: il layout puo' cambiare,
 * `data-match-id` no.
 *
 * Da' quello che nessuna delle API provate dava per la Serie C: l'undici
 * titolare col numero di maglia e il ruolo, la panchina, **il modulo** e
 * l'allenatore.
 *
 * Il difetto e' quello di tutti i parser HTML: quando cambiano il markup si
 * rompe, e si rompe in silenzio. Per questo `leggiFormazioni` torna null
 * invece di una formazione vuota, e chi chiama lo segnala fra gli avvisi.
 */

const BASE = 'https://www.seriec.com';
const UA = 'daunia-app/1.0 (app tifosi non ufficiale; contatto via github.com/artistsuiteapp)';

/** Il gruppo C: e' quello del Foggia. */
export const GIRONE_C = 'girone-c';

const ORE = 60 * 60 * 1000;

const senzaTag = (s) => String(s ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Gli id delle partite, presi dal calendario.
 *
 * Il calendario e' una pagina sola con dentro tutti e tre i gironi, e pesa
 * quattro megabyte: si scarica una volta e si tengono gli id, che non cambiano.
 */
export async function fetchIdPartite() {
  const r = await fetch(`${BASE}/calendario`, { headers: { 'User-Agent': UA } });
  if (!r.ok) return { partite: [], warnings: [`Lega Pro calendario: HTTP ${r.status}`] };
  const html = await r.text();

  const partite = [];
  const bottone = /data-match-id="([a-z0-9]+)"[^>]*data-request="onLoadMatchDetails"/g;
  let m;
  while ((m = bottone.exec(html))) {
    // le due squadre sono negli `alt` dei loghi che precedono il bottone
    const prima = html.slice(Math.max(0, m.index - 3000), m.index);
    const loghi = [...prima.matchAll(/alt="([^"]{3,40})"\s+class="team-logo"/g)].map((x) => x[1]);
    if (loghi.length < 2) continue;
    partite.push({ id: m[1], casa: loghi[loghi.length - 2], ospiti: loghi[loghi.length - 1] });
  }

  return {
    partite,
    warnings: partite.length ? [] : ['Lega Pro: nessun id partita nel calendario, il markup e cambiato'],
  };
}

/** Il dettaglio di una partita: HTML del pannello che il sito apre al clic. */
export async function fetchDettaglio(matchId) {
  const r = await fetch(`${BASE}/calendario`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'X-Requested-With': 'XMLHttpRequest',
      'X-OCTOBER-REQUEST-HANDLER': 'onLoadMatchDetails',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ match_id: matchId }),
  });
  if (!r.ok) return { html: null, problema: `HTTP ${r.status}` };
  const j = await r.json().catch(() => null);
  const html = j?.['#match-details-modal-content'] ?? null;
  return { html, problema: html ? null : 'risposta senza pannello' };
}

/**
 * Legge le formazioni dal pannello.
 *
 * Torna null quando non trova la sezione: e' la differenza fra "non hanno
 * ancora pubblicato le formazioni" e "il parser si e' rotto". Chi chiama
 * distingue i due casi guardando quanto manca al fischio d'inizio.
 */
export function leggiFormazioni(html) {
  if (!html || !html.includes('lineups-section')) return null;

  const colonne = [...html.matchAll(/<div class="lineup-col">([\s\S]*?)(?=<div class="lineup-col">|<\/div>\s*<\/div>\s*<\/div>)/g)]
    .map((m) => m[1]);
  if (colonne.length < 2) return null;

  const leggiColonna = (blocco) => {
    const squadra = senzaTag((blocco.match(/<div class="lineup-header">\s*<strong>([^<]*)<\/strong>/) ?? [])[1]);
    const modulo = senzaTag((blocco.match(/<span class="formation">\(?([^<)]*)\)?<\/span>/) ?? [])[1]) || null;
    const allenatore = senzaTag((blocco.match(/<div class="lineup-manager">([^<]*)</) ?? [])[1])
      .replace(/^All\.\s*/i, '') || null;

    const giocatori = [...blocco.matchAll(
      /<li class="lineup-player">\s*<span class="jersey">([^<]*)<\/span>\s*<span class="player-name">([^<]*)<\/span>(?:\s*<span class="position">([^<]*)<\/span>)?/g,
    )].map((p) => ({
      numero: Number(senzaTag(p[1])) || null,
      nome: senzaTag(p[2]),
      ruolo: senzaTag(p[3]) || null,
    })).filter((p) => p.nome);

    return { squadra, modulo, allenatore, giocatori };
  };

  const casa = leggiColonna(colonne[0]);
  const ospiti = leggiColonna(colonne[1]);
  if (!casa.giocatori.length || !ospiti.giocatori.length) return null;

  return { casa, ospiti };
}

export { senzaTag };


/**
 * Le formazioni della partita piu recente fra quelle indicate.
 *
 * Il calendario pesa quattro megabyte, quindi non si scarica a ogni giro: gli
 * id restano nella cache passata da chi chiama, e si va a riprenderli solo
 * quando la partita cercata non c'e. Un id opaco non cambia, un calendario
 * pubblicato a inizio stagione nemmeno.
 */
export async function fetchFormazioni(partite, cache = {}) {
  const warnings = [];
  const daFare = (partite ?? []).filter((m) => m.kickoff);
  if (!daFare.length) return { formazioni: {}, cache, warnings };

  const nome = (m, lato) => (lato === 'casa'
    ? (m.homeName ?? m.home?.name ?? m.home?.shortName)
    : (m.awayName ?? m.away?.name ?? m.away?.shortName));

  const combacia = (a, b) => {
    const p = (x) => String(x ?? '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    const [x, y] = [p(a), p(b)];
    return Boolean(x) && Boolean(y) && (x.includes(y) || y.includes(x));
  };

  let ids = cache.partite ?? null;
  const fuori = {};

  for (const m of daFare) {
    const chiave = `${m.kickoff.slice(0, 10)}|${nome(m, 'casa')}|${nome(m, 'ospiti')}`;
    let id = cache.per?.[chiave];

    if (!id) {
      if (!ids) {
        const c = await fetchIdPartite();
        warnings.push(...c.warnings);
        ids = c.partite;
      }
      const trovata = ids.find((x) => combacia(x.casa, nome(m, 'casa')) && combacia(x.ospiti, nome(m, 'ospiti')));
      if (!trovata) {
        /*
         * Nel calendario il bottone dei dettagli compare solo per le partite
         * che la Lega ha gia aperto. Se manca a poche ore dal fischio, o
         * l'aprono piu tardi o e cambiato qualcosa: in entrambi i casi
         * qualcuno deve saperlo prima della partita, non dopo.
         */
        const mancano = Date.parse(m.kickoff) - Date.now();
        if (mancano > 0 && mancano < 4 * ORE) {
          warnings.push(`Lega Pro: ${nome(m, 'casa')}-${nome(m, 'ospiti')} fra meno di quattro ore e nel calendario non ha ancora un id: le formazioni potrebbero non arrivare`);
        }
        continue;
      }
      id = trovata.id;
    }

    const d = await fetchDettaglio(id);
    if (d.problema) { warnings.push(`Lega Pro dettaglio ${chiave}: ${d.problema}`); continue; }

    const f = leggiFormazioni(d.html);
    if (f) fuori[m.id ?? chiave] = f;
    else {
      // l'id c'e ma il pannello non ha le formazioni: o non le hanno ancora
      // pubblicate, o il markup e cambiato. A ridosso del fischio la
      // differenza conta, e va detta.
      const mancano = Date.parse(m.kickoff) - Date.now();
      if (mancano > 0 && mancano < 2 * ORE) {
        warnings.push(`Lega Pro: ${nome(m, 'casa')}-${nome(m, 'ospiti')} fra meno di due ore e le formazioni non sono ancora pubblicate`);
      }
    }
    cache.per = { ...(cache.per ?? {}), [chiave]: id };
  }

  return { formazioni: fuori, cache: { ...cache, partite: ids ?? cache.partite }, warnings };
}
