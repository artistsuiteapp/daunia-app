import { Image } from 'expo-image';

/**
 * Marchio dell'app.
 *
 * Immagine e non piu disegno vettoriale: l'emblema definitivo arriva da fuori,
 * quindi qui si mostra e basta. Due file, uno piccolo e uno grande, cosi una
 * icona da 40 punti non scarica un'immagine da mezzo megabyte.
 */
const SMALL = require('../assets/brand/logo-96.png');
const LARGE = require('../assets/brand/logo-192.png');

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      source={size > 72 ? LARGE : SMALL}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={220}
      accessibilityLabel="Il Tifo della Daunia"
    />
  );
}
