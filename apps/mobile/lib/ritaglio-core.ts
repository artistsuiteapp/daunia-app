/**
 * I conti del ritaglio dell'immagine del profilo.
 *
 * Niente React e niente canvas: solo la matematica che dice quale pezzo
 * dell'immagine originale finisce nel cerchio. E la parte che si sbaglia, e
 * sbagliarla si vede subito — la foto esce storta o tagliata male — ma capire
 * perche no.
 *
 * Il modello: un riquadro quadrato di lato `lato`, dentro cui l'immagine sta
 * come una fotografia che si puo spostare e ingrandire. Lo zoom parte da 1,
 * che vuol dire "grande quanto basta a coprire il riquadro".
 */

export type Sorgente = { larghezza: number; altezza: number };
export type Vista = { zoom: number; x: number; y: number };
export type Ritaglio = { sx: number; sy: number; lato: number };

/** Quanto va ingrandita l'immagine perche copra il riquadro senza buchi. */
export function scalaMinima(img: Sorgente, lato: number): number {
  const m = Math.min(img.larghezza, img.altezza);
  return m > 0 ? lato / m : 1;
}

/**
 * Tiene lo spostamento dentro i limiti.
 *
 * Senza questo si puo trascinare l'immagine fuori dal riquadro e restano
 * angoli vuoti, che poi nel cerchio diventano trasparenza o bianco.
 */
export function limita(img: Sorgente, lato: number, vista: Vista): Vista {
  const zoom = Math.max(1, Math.min(vista.zoom, 6));
  const s = scalaMinima(img, lato) * zoom;
  const larghezza = img.larghezza * s;
  const altezza = img.altezza * s;

  // x e y sono l'angolo in alto a sinistra dell'immagine rispetto al riquadro:
  // vanno da "immagine tutta a destra" (0) a "tutta a sinistra" (lato - larghezza)
  const minX = Math.min(0, lato - larghezza);
  const minY = Math.min(0, lato - altezza);
  return {
    zoom,
    x: Math.max(minX, Math.min(0, vista.x)),
    y: Math.max(minY, Math.min(0, vista.y)),
  };
}

/**
 * Il rettangolo dell'immagine originale da ritagliare.
 *
 * Torna coordinate nei pixel veri della foto, non in quelli a schermo: e
 * quello che serve a disegnarla su una tela alla risoluzione finale.
 */
export function calcolaRitaglio(img: Sorgente, lato: number, vista: Vista): Ritaglio {
  const v = limita(img, lato, vista);
  const s = scalaMinima(img, lato) * v.zoom;
  return {
    sx: senzaMenoZero(-v.x / s),
    sy: senzaMenoZero(-v.y / s),
    lato: lato / s,
  };
}

/*
 * In JavaScript -0 esiste ed e diverso da 0 per i confronti stretti. Nasce da
 * solo qui, negando uno spostamento nullo, e non fa danni alla tela ma fa
 * fallire in modo incomprensibile qualsiasi controllo scritto dopo.
 */
const senzaMenoZero = (n: number) => (n === 0 ? 0 : n);

/** Vista di partenza: immagine centrata e appena coprente. */
export function vistaIniziale(img: Sorgente, lato: number): Vista {
  const s = scalaMinima(img, lato);
  return limita(img, lato, {
    zoom: 1,
    x: (lato - img.larghezza * s) / 2,
    y: (lato - img.altezza * s) / 2,
  });
}
