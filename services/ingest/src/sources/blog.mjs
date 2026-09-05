/**
 * Fonte 3: i post redazionali scritti a mano in data/blog/*.md.
 * Niente CMS da mantenere per una demo: un file per articolo, frontmatter minimo.
 *
 *   ---
 *   title: Perche il 3-5-2 di Auteri regge
 *   date: 2026-09-03
 *   image: https://...
 *   excerpt: Una riga di sommario.
 *   ---
 *   Corpo dell'articolo in testo semplice.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export async function fetchEditorial(blogDir) {
  if (!existsSync(blogDir)) return [];
  const files = (await readdir(blogDir)).filter((f) => f.endsWith('.md'));
  const posts = [];

  for (const file of files) {
    const raw = await readFile(path.join(blogDir, file), 'utf8');
    const { data, body } = frontmatter(raw);
    if (!data.title) continue;
    const slug = data.slug || file.replace(/\.md$/, '');
    posts.push({
      id: `editorial-${slug}`,
      date: new Date(data.date || Date.now()).toISOString(),
      title: data.title,
      excerpt: data.excerpt || body.split('\n').find((l) => l.trim())?.slice(0, 180) || '',
      url: data.url || '',
      image: data.image || null,
      kind: 'editorial',
      slug,
      body: body.trim(),
      source: 'editorial',
    });
  }
  return posts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

/** Frontmatter YAML ridotto all'essenziale: chiave: valore, una per riga. */
function frontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: m[2] };
}
