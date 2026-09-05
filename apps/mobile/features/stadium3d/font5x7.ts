/**
 * Bitmap 5x7 delle sole lettere che servono al mosaico della Curva Nord.
 * Ogni riga e una stringa di 5 caratteri: '1' seggiolino chiaro, '0' seggiolino di fondo.
 */
export const GLYPHS: Record<string, string[]> = {
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10101', '10011', '10001', '10001'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  S: ['01111', '10000', '10000', '01110', '00001', '10001', '01110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;

/**
 * Rende una parola su una griglia di celle: restituisce un test
 * (col, row) -> true quando la cella fa parte di una lettera.
 * L'origine della parola e centrata sulla larghezza disponibile.
 */
export function makeWordMask(word: string, cols: number, rows: number, opts: {
  scale?: number;
  /** riga della gradinata su cui appoggiare la base delle lettere, 0 = prima fila */
  baseRow?: number;
} = {}) {
  const letters = word.toUpperCase().split('');
  // la scala e limitata sia dalla lunghezza della gradinata sia dal numero di file:
  // senza il secondo vincolo su una tribuna lunga le lettere uscivano dall'alto
  const byWidth = Math.floor(cols / (letters.length * (GLYPH_W + 1)));
  const byHeight = Math.floor((rows * 0.84) / GLYPH_H);
  const scale = opts.scale ?? Math.max(1, Math.min(byWidth, byHeight));
  const gap = scale;
  const wordW = letters.length * GLYPH_W * scale + (letters.length - 1) * gap;
  const startCol = Math.round((cols - wordW) / 2);
  const wordH = GLYPH_H * scale;
  // senza indicazione la scritta si centra sull'altezza della gradinata
  const baseRow = opts.baseRow ?? Math.max(0, Math.round((rows - wordH) / 2));

  return (col: number, row: number): boolean => {
    const gy = row - baseRow;
    if (gy < 0 || gy >= wordH) return false;
    let x = col - startCol;
    if (x < 0) return false;
    const advance = GLYPH_W * scale + gap;
    const index = Math.floor(x / advance);
    if (index >= letters.length) return false;
    const inLetter = x - index * advance;
    if (inLetter >= GLYPH_W * scale) return false;
    const glyph = GLYPHS[letters[index]!] ?? GLYPHS[' ']!;
    // le lettere si leggono dall'alto: la riga 0 della bitmap sta in cima
    const gRow = GLYPH_H - 1 - Math.floor(gy / scale);
    const gCol = Math.floor(inLetter / scale);
    return glyph[gRow]![gCol] === '1';
  };
}
