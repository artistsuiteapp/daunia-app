#!/usr/bin/env node
/**
 * La grafica della settimana, da condividere.
 *
 *   node services/grafiche/settimana.mjs              # la settimana appena chiusa
 *   node services/grafiche/settimana.mjs --corrente   # quella in corso
 *   node services/grafiche/settimana.mjs --anteprima  # senza database, per vedere com'e
 *   node services/grafiche/settimana.mjs --iniziali   # "Anna C." invece del nome intero
 *
 * UN FORMATO SOLO PER TUTTI E DUE
 *
 * 1080x1920 e la storia di Instagram ed e anche quella di Facebook: sono lo
 * stesso formato e la stessa immagine funziona su entrambe. Farne due sarebbe
 * lavoro doppio per lo stesso risultato.
 *
 * Il contenuto sta fra y=300 e y=1650: sopra e sotto ci vanno le interfacce
 * delle due app, e quello che ci finisce dentro non si legge.
 *
 * PERCHE SVG E NON UN BROWSER
 *
 * Un browser headless per fare un'immagine ferma vuol dire trecento megabyte di
 * Chromium da scaricare a ogni esecuzione, su un monte ore di GitHub che qui e
 * gia stato bruciato una volta. Un SVG disegnato a mano e convertito con resvg
 * parte in un secondo e resta leggibile: se un giorno il primo posto va storto,
 * si apre il file e si vede dov'e.
 *
 * NIENTE MARCHI ALTRUI
 *
 * Nessuno stemma, nessun nome di club come marchio del prodotto: valgono le
 * stesse regole del resto dell'app (apps/mobile/theme/brand.ts).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Resvg } from '@resvg/resvg-js';

const ARG = new Set(process.argv.slice(2));
const ANTEPRIMA = ARG.has('--anteprima');
const CORRENTE = ARG.has('--corrente');
const INIZIALI = ARG.has('--iniziali');

const URL_BASE = (process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const CHIAVE = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const ROSSO = '#EE1111';
const ROSSO_CUPO = '#CC1111';
const NERO = '#0A0A0B';
const BIANCO = '#FFFFFF';
const GRIGIO = '#8E8E93';

const L = 1080;
const A = 1920;

/* ------------------------------------------------------------- la settimana */

/** Lunedi della settimana ISO che contiene `d`. */
export function lunedi(d) {
  const x = new Date(d);
  const giorno = (x.getUTCDay() + 6) % 7; // 0 = lunedi
  x.setUTCDate(x.getUTCDate() - giorno);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export function periodo(quando) {
  const da = lunedi(quando);
  const a = new Date(da);
  a.setUTCDate(a.getUTCDate() + 6);
  const stessoMese = da.getUTCMonth() === a.getUTCMonth();
  return {
    da,
    a,
    etichetta: stessoMese
      ? `${da.getUTCDate()}–${a.getUTCDate()} ${MESI[a.getUTCMonth()]}`
      : `${da.getUTCDate()} ${MESI[da.getUTCMonth()]} – ${a.getUTCDate()} ${MESI[a.getUTCMonth()]}`,
    chiave: chiaveIso(da),
  };
}

/**
 * "2026-W37", la stessa forma che usa il database.
 *
 * La settimana ISO appartiene all'anno del suo GIOVEDI, non a quello della
 * data: il 1 gennaio 2027 cade di venerdi e sta nella settimana 53 del 2026.
 * Per questo si passa prima al giovedi della stessa settimana, sempre, invece
 * di sommare tre giorni come se la data fosse gia un lunedi.
 */
export function chiaveIso(d) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7) + 3);

  const primo = new Date(Date.UTC(x.getUTCFullYear(), 0, 4));
  primo.setUTCDate(primo.getUTCDate() - ((primo.getUTCDay() + 6) % 7) + 3);

  const settimana = 1 + Math.round((x - primo) / (7 * 86400000));
  return `${x.getUTCFullYear()}-W${String(settimana).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ i dati */

async function rpc(nome, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: CHIAVE,
      authorization: `Bearer ${CHIAVE}`,
    },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`${nome}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function dati(quando) {
  if (ANTEPRIMA) {
    /*
     * Solo per guardare come viene, e si vede che e finta: i nomi sono
     * dichiarati tali. Non finisce mai in data/, scrive in output/ che non e
     * versionato.
     */
    return {
      classifica: [
        { posizione: 1, nome: 'ANTEPRIMA uno', punti: 285 },
        { posizione: 2, nome: 'ANTEPRIMA due', punti: 240 },
        { posizione: 3, nome: 'ANTEPRIMA tre', punti: 175 },
        { posizione: 4, nome: 'ANTEPRIMA quattro', punti: 120 },
        { posizione: 5, nome: 'ANTEPRIMA cinque', punti: 95 },
      ],
      strisce: [{ nome: 'ANTEPRIMA uno', striscia: 4 }],
    };
  }

  if (!URL_BASE || !CHIAVE) {
    throw new Error('Mancano SUPABASE_URL e SUPABASE_ANON_KEY. Con --anteprima si vede lo stesso come viene.');
  }

  const [classifica, strisce] = await Promise.all([
    rpc('classifica', { tipo: 'settimana', quanti: 5, quando: quando.toISOString() }),
    rpc('strisce', { quanti: 3 }),
  ]);

  return {
    classifica: (classifica ?? []).map((r) => ({
      posizione: Number(r.posizione), nome: String(r.nome), punti: Number(r.punti),
    })),
    strisce: (strisce ?? [])
      .filter((r) => Number(r.striscia) >= 2)
      .map((r) => ({ nome: String(r.nome), striscia: Number(r.striscia) })),
  };
}

/* ------------------------------------------------------------- il disegno */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * Il nome come compare sulla grafica.
 *
 * Con --iniziali diventa "Anna C.". Nell'app il nome si vede gia in
 * classifica, ma un'immagine su Instagram la vede anche chi l'app non ce l'ha:
 * l'opzione c'e per chi vuole tenere la cosa dentro casa.
 */
function nomeMostrato(nome) {
  const pulito = String(nome ?? '').trim();
  if (!INIZIALI) return taglia(pulito, 18);
  const pezzi = pulito.split(/\s+/);
  if (pezzi.length === 1) return taglia(pezzi[0], 14);
  return taglia(`${pezzi[0]} ${pezzi[pezzi.length - 1][0]}.`, 16);
}

function taglia(s, quanti) {
  return s.length <= quanti ? s : `${s.slice(0, quanti - 1)}…`;
}

const FONT = "'Helvetica Neue', Helvetica, Arial, 'DejaVu Sans', sans-serif";

function testo(x, y, contenuto, { size = 40, peso = 400, colore = BIANCO, ancora = 'start', spazio = 0, opacita = 1 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${peso}" `
    + `fill="${colore}" text-anchor="${ancora}" letter-spacing="${spazio}" opacity="${opacita}">${esc(contenuto)}</text>`;
}

export function disegna({ classifica, strisce, periodo: p }) {
  const pezzi = [];

  pezzi.push(`<rect width="${L}" height="${A}" fill="${NERO}"/>`);
  // un alone rosso in alto a sinistra: da profondita senza mettere una foto
  pezzi.push(`<circle cx="120" cy="260" r="560" fill="url(#alone)" opacity="0.55"/>`);
  pezzi.push(`<rect x="0" y="292" width="180" height="8" fill="${ROSSO}"/>`);

  pezzi.push(testo(80, 360, 'IL TIFO DELLA DAUNIA', { size: 30, peso: 700, colore: ROSSO, spazio: 4 }));
  pezzi.push(testo(80, 410, p.etichetta, { size: 30, colore: GRIGIO }));

  pezzi.push(testo(80, 540, 'LA SETTIMANA', { size: 104, peso: 800, spazio: -2 }));
  pezzi.push(testo(80, 650, 'DELLA CURVA', { size: 104, peso: 800, colore: ROSSO, spazio: -2 }));

  /*
   * Quanto ci sta, deciso prima di disegnare.
   *
   * Cinque righe piu le strisce non ci stanno, e il primo tentativo infatti
   * scriveva "IN SERIE" sopra il piede della grafica. Invece di accorciare i
   * riquadri -- che poi non si leggono -- si taglia il contenuto: si tiene
   * sempre il podio, e quello che avanza va via dal fondo.
   */
  const CIMA = 750;
  const FONDO = 1560;
  const ALTA_PRIMO = 200;
  const ALTA_RIGA = 128;
  const SPAZIO = 16;

  let righe = classifica.slice(0, 5);
  let inSerie = strisce.slice(0, 2);
  const quantoOccupa = () =>
    (righe.length ? ALTA_PRIMO + (righe.length - 1) * ALTA_RIGA + righe.length * SPAZIO : 0)
    + (inSerie.length ? 64 + inSerie.length * 120 : 0);

  while (quantoOccupa() > FONDO - CIMA) {
    if (inSerie.length > 1) inSerie.pop();
    else if (righe.length > 3) righe.pop();
    else if (inSerie.length) inSerie.pop();
    else righe.pop();
  }

  let y = CIMA;

  if (righe.length === 0) {
    pezzi.push(testo(80, y + 40, 'Questa settimana non ha giocato nessuno.', { size: 40, colore: GRIGIO }));
  }

  righe.forEach((r, i) => {
    const primo = i === 0;
    const alta = primo ? ALTA_PRIMO : ALTA_RIGA;
    pezzi.push(`<rect x="80" y="${y}" width="920" height="${alta}" rx="28" fill="${primo ? ROSSO_CUPO : '#151517'}"/>`);

    pezzi.push(testo(132, y + (primo ? 128 : 82), String(r.posizione), {
      size: primo ? 96 : 56, peso: 800, colore: primo ? BIANCO : GRIGIO,
    }));
    pezzi.push(testo(primo ? 260 : 210, y + (primo ? 112 : 78), nomeMostrato(r.nome), {
      size: primo ? 58 : 42, peso: 700,
    }));
    if (primo) pezzi.push(testo(260, y + 160, 'primo della settimana', { size: 30, colore: 'rgba(255,255,255,0.75)' }));

    pezzi.push(testo(950, y + (primo ? 112 : 78), String(r.punti), {
      size: primo ? 64 : 44, peso: 800, ancora: 'end',
    }));
    pezzi.push(testo(950, y + (primo ? 158 : 108), 'punti', {
      size: 26, colore: primo ? 'rgba(255,255,255,0.75)' : GRIGIO, ancora: 'end',
    }));

    y += alta + SPAZIO;
  });

  if (inSerie.length) {
    y += 36;
    pezzi.push(testo(80, y, 'IN SERIE', { size: 30, peso: 700, colore: ROSSO, spazio: 4 }));
    y += 28;
    inSerie.forEach((s) => {
      pezzi.push(`<rect x="80" y="${y}" width="920" height="104" rx="24" fill="#151517"/>`);
      pezzi.push(testo(132, y + 66, nomeMostrato(s.nome), { size: 40, peso: 700 }));
      pezzi.push(testo(950, y + 66, `${s.striscia} di fila`, { size: 36, peso: 700, colore: ROSSO, ancora: 'end' }));
      y += 120;
    });
  }

  pezzi.push(testo(80, 1600, 'daunia.vercel.app', { size: 34, peso: 700 }));
  pezzi.push(testo(80, 1646, 'Progetto indipendente di tifosi. Non affiliato al Calcio Foggia 1920.', {
    size: 22, colore: GRIGIO,
  }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}" viewBox="0 0 ${L} ${A}">
  <defs>
    <radialGradient id="alone">
      <stop offset="0%" stop-color="${ROSSO}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${ROSSO}" stop-opacity="0"/>
    </radialGradient>
  </defs>
${pezzi.join('\n')}
</svg>`;
}

/* ------------------------------------------------------------------ avvio */

async function main() {
  const adesso = new Date();
  const quando = CORRENTE ? adesso : new Date(adesso.getTime() - 7 * 86400000);
  const p = periodo(quando);

  const d = await dati(quando);

  if (!ANTEPRIMA && d.classifica.length === 0) {
    // Meglio nessuna grafica che una grafica che festeggia nessuno.
    console.log(JSON.stringify({ fatto: false, motivo: 'nessun punto in questa settimana', settimana: p.chiave }));
    return;
  }

  const svg = disegna({ ...d, periodo: p });
  const cartella = ANTEPRIMA ? 'output/grafiche' : 'data/grafiche';
  await mkdir(cartella, { recursive: true });

  const base = path.join(cartella, `${p.chiave}${INIZIALI ? '-iniziali' : ''}`);
  await writeFile(`${base}.svg`, svg);

  const png = new Resvg(svg, { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: L } })
    .render().asPng();
  await writeFile(`${base}.png`, png);

  console.log(JSON.stringify({
    fatto: true,
    settimana: p.chiave,
    periodo: p.etichetta,
    inClassifica: d.classifica.length,
    strisce: d.strisce.length,
    file: [`${base}.svg`, `${base}.png`],
  }, null, 1));
}

/* Eseguito a mano o dal cron; importato dai test, che non devono far partire niente. */
const avviatoDaRiga = process.argv[1] && process.argv[1].endsWith('settimana.mjs');
if (avviatoDaRiga) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
