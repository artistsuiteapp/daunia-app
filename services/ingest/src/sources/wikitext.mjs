/** Utility di parsing del wikitext. Tenute separate perche sono la parte piu fragile. */

/** Estrae i blocchi {{Nome|...}} contando le graffe, perche i parametri contengono altri template. */
export function extractTemplates(wt, name) {
  const out = [];
  const needle = `{{${name}`;
  let i = 0;
  while ((i = wt.indexOf(needle, i)) !== -1) {
    const after = wt[i + needle.length];
    if (after && !/[|\s}]/.test(after)) { i += needle.length; continue; }
    let depth = 0;
    let j = i;
    for (; j < wt.length; j++) {
      if (wt.startsWith('{{', j)) { depth++; j++; }
      else if (wt.startsWith('}}', j)) { depth--; j++; if (depth === 0) { j++; break; } }
    }
    out.push({ block: wt.slice(i, j), start: i });
    i = j;
  }
  return out;
}

/** Titoli di sezione con la loro posizione, per sapere sotto quale sezione cade un template. */
export function sectionRanges(wt, level = 3) {
  const marker = '='.repeat(level);
  const re = new RegExp(`^${marker}\\s*([^=\\n]+?)\\s*${marker}\\s*$`, 'gm');
  const out = [];
  let m;
  while ((m = re.exec(wt)) !== null) out.push({ title: m[1].trim(), start: m.index });
  return out;
}

/** Titolo della sezione di livello `level` che contiene la posizione `pos`. */
export function sectionAt(ranges, pos) {
  let hit = null;
  for (const r of ranges) { if (r.start <= pos) hit = r; else break; }
  return hit ? hit.title : null;
}

/** Divide i parametri di un template sulle sole pipe di primo livello. */
export function templateParams(block) {
  const inner = block.slice(2, -2);
  const parts = [];
  let tpl = 0;
  let link = 0;
  let buf = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner.startsWith('{{', i)) { tpl++; buf += '{{'; i++; continue; }
    if (inner.startsWith('}}', i)) { tpl--; buf += '}}'; i++; continue; }
    if (inner.startsWith('[[', i)) { link++; buf += '[['; i++; continue; }
    if (inner.startsWith(']]', i)) { link--; buf += ']]'; i++; continue; }
    if (inner[i] === '|' && tpl === 0 && link === 0) { parts.push(buf); buf = ''; continue; }
    buf += inner[i];
  }
  parts.push(buf);
  const params = { _name: parts[0].trim() };
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return params;
}

/** [[Pagina|Testo]] -> Testo, [[Pagina]] -> Pagina. */
export function stripLinks(s) {
  return String(s || '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
}

export function stripRefs(s) {
  return String(s || '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<br\s*\/?>/gi, ', ');
}

/** Ripulisce una cella o un valore: link, ref, template residui, apici del wiki. */
export function plain(s) {
  return stripLinks(stripRefs(s))
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const MESI = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

/**
 * Costruisce un ISO con offset esplicito di Roma.
 * L'offset si legge dalla sigla nel campo Ora, che Wikipedia riporta sempre (CEST o CET).
 */
export function buildKickoff(giornomese, anno, ora) {
  if (!giornomese || !anno) return null;
  const m = plain(giornomese).match(/(\d{1,2})\s+([a-zà-ù]+)/i);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MESI[m[2].toLowerCase()];
  if (!month) return null;
  const year = Number(String(anno).replace(/\D/g, ''));
  if (!year) return null;
  const t = plain(ora).match(/(\d{1,2})[:.](\d{2})/);
  const hh = t ? Number(t[1]) : 15;
  const mm = t ? Number(t[2]) : 0;
  const offset = /CEST/i.test(String(ora)) ? '+02:00' : /CET/i.test(String(ora)) ? '+01:00' : romeOffset(month);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00${offset}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Fallback quando la sigla del fuso manca: ora legale indicativa da aprile a ottobre. */
function romeOffset(month) {
  return month >= 4 && month <= 10 ? '+02:00' : '+01:00';
}

/** "1ª giornata" -> 1, "16º turno" -> 16 */
export function parseMatchday(turno) {
  const m = plain(turno).match(/(\d+)\s*[ªº°]?\s*(giornata|turno)/i);
  return m ? Number(m[1]) : null;
}
