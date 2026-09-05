/**
 * Fonte 5: ritratti dei giocatori da Wikipedia e Wikimedia Commons.
 *
 * La fototeca del club e ferma alla stagione scorsa, quindi quasi tutta la rosa
 * attuale non ha immagine. Qui si prendono le foto a licenza libera, che sono
 * le uniche riutilizzabili: quelle dei siti sportivi e di Transfermarkt sono
 * coperte da copyright e non si toccano.
 *
 * Ogni foto porta con se autore e licenza, perche la CC BY-SA chiede
 * l'attribuzione e l'app la mostra.
 */
import { getJson, sleep, stripHtml } from '../util.mjs';

const IT = 'https://it.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const TTL = 7 * 24 * 3600 * 1000;

/** Le licenze che permettono il riuso. Tutto il resto viene scartato. */
const FREE = /^(cc0|cc[- ]by([- ]sa)?([- ]\d(\.\d)?)?|public domain|pd|attribution)/i;

/** Una sola richiesta per un blocco di nomi: l'API accetta fino a 50 titoli. */
async function pageImages(titles) {
  if (!titles.length) return new Map();
  const u = new URL(IT);
  u.searchParams.set('action', 'query');
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  u.searchParams.set('prop', 'pageimages');
  u.searchParams.set('piprop', 'original');
  u.searchParams.set('redirects', '1');
  u.searchParams.set('titles', titles.join('|'));

  const data = await getJson(u.toString(), { ttl: TTL });
  const out = new Map();

  // le redirezioni vanno rimappate sul nome chiesto, altrimenti la foto
  // resterebbe associata a un titolo che non abbiamo mai cercato
  const alias = new Map();
  for (const r of data.query?.redirects ?? []) alias.set(r.to, r.from);
  for (const n of data.query?.normalized ?? []) alias.set(n.to, n.from);

  for (const p of data.query?.pages ?? []) {
    if (p.missing || !p.original?.source) continue;
    const asked = alias.get(p.title) ?? p.title;
    out.set(asked, { url: p.original.source, page: p.title });
  }
  return out;
}

/** Autore e licenza del file, per l'attribuzione. */
async function fileCredit(fileUrl) {
  const name = decodeURIComponent(fileUrl.split('/').pop() ?? '');
  const u = new URL(COMMONS);
  u.searchParams.set('action', 'query');
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  u.searchParams.set('prop', 'imageinfo');
  u.searchParams.set('iiprop', 'extmetadata');
  u.searchParams.set('titles', `File:${name}`);

  try {
    const data = await getJson(u.toString(), { ttl: TTL });
    const meta = (data.query?.pages ?? [])[0]?.imageinfo?.[0]?.extmetadata ?? {};
    const licence = stripHtml(meta.LicenseShortName?.value ?? '');
    const author = stripHtml(meta.Artist?.value ?? '').slice(0, 80);
    return { licence, author, free: FREE.test(licence) };
  } catch {
    return { licence: '', author: '', free: false };
  }
}

/**
 * Cerca il ritratto per ogni nome. Prova il nome nudo e, se non basta, la
 * forma disambiguata che Wikipedia usa per i calciatori omonimi.
 */
export async function fetchPlayerPortraits(names) {
  const found = new Map();
  const chunk = (arr, n) => arr.reduce((a, v, i) => (i % n ? a[a.length - 1].push(v) : a.push([v]), a), []);

  for (const variant of [(n) => n, (n) => `${n} (calciatore)`]) {
    const missing = names.filter((n) => !found.has(n));
    if (!missing.length) break;

    for (const block of chunk(missing.map(variant), 40)) {
      const res = await pageImages(block);
      for (const [title, hit] of res) {
        const original = names.find((n) => variant(n) === title) ?? title;
        if (!found.has(original)) found.set(original, hit);
      }
      await sleep(400);
    }
  }

  // si tengono solo le immagini con licenza libera verificata
  const out = new Map();
  for (const [name, hit] of found) {
    const credit = await fileCredit(hit.url);
    await sleep(250);
    if (!credit.free) continue;
    out.set(name, { url: hit.url, licence: credit.licence, author: credit.author, page: hit.page });
  }
  return out;
}
