/**
 * Le formazioni ufficiali dal sito della Lega, lette dal guardiano.
 *
 * Stesse regole del modulo dell'ingest (`services/ingest/src/sources/legapro.mjs`),
 * ma qui servono per la via veloce: l'ingest passa da GitHub e da un deploy, e
 * fra cron e ricostruzione ci mette fino a venti minuti. Le formazioni escono
 * anche a venti minuti dal fischio, quindi con quella strada si arriva tardi.
 *
 * Il guardiano gira ogni minuto ed e gia sveglio: scrive nel database e l'app
 * legge in tempo reale, come fa per il punteggio.
 *
 * seriec.com consente tutti i bot tranne i crawler di addestramento AI, e
 * l'endpoint del calendario e un AJAX di October CMS con un id per partita: un
 * id opaco resta valido anche quando cambia il layout.
 */

const BASE = 'https://www.seriec.com';
const UA = 'daunia-app/1.0 (app tifosi non ufficiale)';

export type GiocatoreLega = { numero: number | null; nome: string; ruolo: string | null };
export type ColonnaLega = {
  squadra: string; modulo: string | null; allenatore: string | null; giocatori: GiocatoreLega[];
};
export type FormazioniLega = { casa: ColonnaLega; ospiti: ColonnaLega };

const senzaTag = (s: unknown) => String(s ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ')
  .trim();

const pulisci = (s: unknown) => String(s ?? '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

const combacia = (a: unknown, b: unknown) => {
  const [x, y] = [pulisci(a), pulisci(b)];
  return Boolean(x) && Boolean(y) && (x.includes(y) || y.includes(x));
};

/**
 * L'id della partita nel calendario della Lega.
 *
 * Il calendario e una pagina sola da quattro megabyte: si scarica una volta e
 * l'id si tiene, perche non cambia. Il bottone dei dettagli compare solo
 * quando la Lega apre la partita, quindi prima del fischio puo non esserci
 * ancora: torna null e si riprova al giro dopo.
 */
export async function trovaId(casa: string, ospiti: string): Promise<string | null> {
  const r = await fetch(`${BASE}/calendario`, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const html = await r.text();

  const bottone = /data-match-id="([a-z0-9]+)"[^>]*data-request="onLoadMatchDetails"/g;
  let m: RegExpExecArray | null;
  while ((m = bottone.exec(html))) {
    const prima = html.slice(Math.max(0, m.index - 3000), m.index);
    const loghi = [...prima.matchAll(/alt="([^"]{3,40})"\s+class="team-logo"/g)].map((x) => x[1]);
    if (loghi.length < 2) continue;
    if (combacia(loghi[loghi.length - 2], casa) && combacia(loghi[loghi.length - 1], ospiti)) {
      return m[1];
    }
  }
  return null;
}

/**
 * Le formazioni di una partita, dal pannello dei dettagli.
 *
 * Torna null quando la sezione non c'e: e la differenza fra "non le hanno
 * ancora pubblicate" e "il parser si e rotto", e a ridosso del fischio conta.
 */
export async function formazioniDi(matchId: string): Promise<FormazioniLega | null> {
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
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return leggiFormazioni(j?.['#match-details-modal-content'] ?? null);
}

export function leggiFormazioni(html: string | null): FormazioniLega | null {
  if (!html || !html.includes('lineups-section')) return null;

  const colonne = [...html.matchAll(
    /<div class="lineup-col">([\s\S]*?)(?=<div class="lineup-col">|<\/div>\s*<\/div>\s*<\/div>)/g,
  )].map((m) => m[1]);
  if (colonne.length < 2) return null;

  const leggiColonna = (blocco: string): ColonnaLega => ({
    squadra: senzaTag((blocco.match(/<div class="lineup-header">\s*<strong>([^<]*)<\/strong>/) ?? [])[1]),
    modulo: senzaTag((blocco.match(/<span class="formation">\(?([^<)]*)\)?<\/span>/) ?? [])[1]) || null,
    allenatore: senzaTag((blocco.match(/<div class="lineup-manager">([^<]*)</) ?? [])[1])
      .replace(/^All\.\s*/i, '') || null,
    giocatori: [...blocco.matchAll(
      /<li class="lineup-player">\s*<span class="jersey">([^<]*)<\/span>\s*<span class="player-name">([^<]*)<\/span>(?:\s*<span class="position">([^<]*)<\/span>)?/g,
    )].map((p) => ({
      numero: Number(senzaTag(p[1])) || null,
      nome: senzaTag(p[2]),
      ruolo: senzaTag(p[3]) || null,
    })).filter((p) => p.nome),
  });

  const casa = leggiColonna(colonne[0]);
  const ospiti = leggiColonna(colonne[1]);
  if (!casa.giocatori.length || !ospiti.giocatori.length) return null;
  return { casa, ospiti };
}
