/**
 * Interruttore unico per le immagini ospitate da terzi.
 *
 * Il prototipo per la societa caricava stemmi, foto giocatori, immagini degli
 * articoli e foto prodotto dai server del club: 350 indirizzi, tutti su
 * calciofoggia1920.net e .store. In una demo mostrata di persona regge; in
 * un'app pubblica non affiliata, con una raccolta fondi sopra, no.
 *
 * Qui si spegne in un punto solo. Crest e Avatar hanno gia il ripiego a
 * monogramma, quindi l'interfaccia non si rompe: cambia aspetto e basta.
 */
export const ALLOW_REMOTE_IMAGES = false;

export function remote(uri: string | null | undefined): string | null {
  return ALLOW_REMOTE_IMAGES ? uri ?? null : null;
}
