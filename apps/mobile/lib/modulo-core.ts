/**
 * Come si dispone un undici sul campo, dato il modulo.
 *
 * Il ruolo dichiarato dalla Lega non basta: per Foggia-Cerignola l'elenco dava
 * sei "Difensore", tre "Centrocampista" e un "Attaccante", ma il modulo era
 * 4-2-3-1. Raggruppando per ruolo si finiva con sei uomini in difesa e un
 * campo che non somigliava a niente.
 *
 * Comanda il modulo: dice quanti uomini per riga. Il ruolo serve solo a
 * decidere chi sta davanti e chi dietro, e l'ordine dell'elenco a rompere le
 * parita -- la Lega li scrive gia dal portiere all'attaccante.
 *
 * Niente React e niente dati: si prova con node --test.
 */

export type Posto = { x: number; y: number };

/** Quanto pesa un ruolo verso l'attacco: piu alto, piu avanti. */
const AVANTI: Array<[RegExp, number]> = [
  [/portiere/i, 0],
  [/difensore/i, 1],
  [/centrocamp/i, 2],
  [/attacc/i, 3],
];

export function pesoRuolo(ruolo: string | null | undefined): number {
  for (const [r, p] of AVANTI) if (r.test(String(ruolo ?? ''))) return p;
  return 2;
}

/**
 * Le righe di un modulo: "4-2-3-1" diventa [4, 2, 3, 1].
 *
 * Torna null quando la stringa non e un modulo o non somma dieci: meglio
 * ripiegare su una disposizione di comodo che disegnare un campo sbagliato.
 */
export function righeDelModulo(modulo: string | null | undefined): number[] | null {
  if (!modulo) return null;
  const numeri = String(modulo).match(/\d+/g)?.map(Number) ?? [];
  if (numeri.length < 2 || numeri.length > 5) return null;
  if (numeri.some((n) => n < 1 || n > 6)) return null;
  // dieci di movimento: il portiere non entra nel modulo
  if (numeri.reduce((a, b) => a + b, 0) !== 10) return null;
  return numeri;
}

/**
 * Le x di una riga, simmetriche attorno al centro.
 *
 * Piu uomini ci sono, piu si allargano: una difesa a cinque tocca le fasce,
 * una punta sola sta in mezzo.
 */
export function larghezze(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [50];
  const bordo = n >= 5 ? 8 : n === 4 ? 14 : 22;
  const passo = (100 - bordo * 2) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(bordo + passo * i));
}

/**
 * Le y delle righe: il portiere sul fondo, le altre distribuite fino
 * all'attacco. Con quattro righe si sta piu stretti che con due.
 */
export function altezze(quante: number): number[] {
  if (quante <= 0) return [];
  const primo = 26;
  const ultimo = 88;
  if (quante === 1) return [ultimo];
  const passo = (ultimo - primo) / (quante - 1);
  return Array.from({ length: quante }, (_, i) => Math.round(primo + passo * i));
}

/**
 * Ordina i dieci di movimento dal piu arretrato al piu avanzato.
 *
 * A parita di ruolo vince chi viene prima nell'elenco: la Lega lo scrive gia
 * in ordine di reparto, e rispettarlo tiene i terzini ai lati invece che al
 * centro per caso.
 */
export function inOrdine<T extends { ruolo?: string | null }>(giocatori: T[]): T[] {
  return giocatori
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (pesoRuolo(a.g.ruolo) - pesoRuolo(b.g.ruolo)) || (a.i - b.i))
    .map((x) => x.g);
}

/**
 * I posti sul campo per l'undici, secondo il modulo.
 *
 * Il primo posto e sempre il portiere. Se il modulo non si legge o non
 * combacia col numero di giocatori, si ripiega su 4-3-3, che e la
 * disposizione che sbaglia di meno quando non si sa.
 */
export function postiDelModulo(modulo: string | null | undefined, quantiInCampo: number): Posto[] {
  const righe = righeDelModulo(modulo) ?? [4, 3, 3];
  const usabili = righe.reduce((a, b) => a + b, 0) === quantiInCampo - 1 ? righe : [4, 3, 3];
  const ys = altezze(usabili.length);

  const posti: Posto[] = [{ x: 50, y: 4 }];
  usabili.forEach((quanti, riga) => {
    for (const x of larghezze(quanti)) posti.push({ x, y: ys[riga] ?? 50 });
  });
  return posti;
}
