import { Platform } from 'react-native';
import { brand } from './brand';

/**
 * Design system in chiave iOS.
 *
 * Tre scelte che cambiano tutto rispetto alla versione precedente:
 *
 * 1. Il carattere dell'interfaccia e quello di sistema (San Francisco su iPhone).
 *    Prima ogni riga era in condensata: leggibile ma da volantino sportivo, non da
 *    app di sistema. La condensata resta solo su punteggi, contatori e numeri grandi,
 *    dove serve il carattere sportivo.
 * 2. La palette segue i colori semantici di iOS in modalita scura: nero pieno di
 *    fondo, grigi elevati per le superfici, etichette a opacita decrescente.
 * 3. Il rosso e un colore d'accento, non un colore di sfondo. Si usa per gli elementi
 *    attivi e per pochi numeri, non per campire interi blocchi.
 */

/** Su web react-native-web ha bisogno della pila esplicita per avere l'aspetto di sistema. */
const SYSTEM = Platform.select({
  ios: undefined,
  android: undefined,
  default: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
}) as string | undefined;

export const colors = {
  /** fondo pagina: nero pieno, come le app di sistema in modalita scura */
  bg: '#000000',
  /** superficie raggruppata di primo livello */
  surface: '#1C1C1E',
  /** superficie sopra un'altra superficie */
  surfaceHi: '#2C2C2E',
  /** superficie appena staccata dal fondo, per le barre */
  bgElevated: '#0B0B0C',

  /** separatore sottile fra righe di una lista */
  separator: 'rgba(84,84,88,0.55)',
  border: 'rgba(84,84,88,0.4)',
  borderStrong: 'rgba(84,84,88,0.7)',

  text: '#FFFFFF',
  textDim: 'rgba(235,235,245,0.62)',
  textFaint: 'rgba(235,235,245,0.32)',

  accent: brand.colors.red,
  accentBright: '#FF3B3B',
  accentSoft: 'rgba(204,17,17,0.18)',
  onAccent: '#FFFFFF',

  live: '#FF453A',
  win: '#30D158',
  draw: '#8E8E93',
  loss: '#FF453A',

  zonePromotion: '#30D158',
  zonePlayoff: '#0A84FF',
  zonePlayout: '#FF9F0A',
  zoneRelegation: '#FF453A',
} as const;

/** Griglia da 4, margini di pagina a 16 come nelle app di sistema. */
export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
} as const;

export const radius = {
  sm: 6, md: 10, lg: 14, xl: 20, xxl: 28, pill: 999,
} as const;

/** Solo per numeri e punteggi: e la firma sportiva che resta. */
export const font = {
  display: 'BarlowCondensed_700Bold',
  displayBlack: 'BarlowCondensed_800ExtraBold',
  displayMedium: 'BarlowCondensed_600SemiBold',
  system: SYSTEM,
} as const;

const sys = (size: number, weight: '400' | '500' | '600' | '700', lineHeight: number, letterSpacing = 0) => ({
  fontFamily: SYSTEM,
  fontSize: size,
  fontWeight: weight,
  lineHeight,
  letterSpacing,
});

/**
 * Scala tipografica di iOS. I nomi seguono quelli di sistema cosi e chiaro
 * quale ruolo ha ogni stile invece di doverlo dedurre dalla dimensione.
 */
export const type = {
  largeTitle: sys(34, '700', 41, 0.37),
  title1: sys(28, '700', 34, 0.36),
  title2: sys(22, '700', 28, 0.35),
  title3: sys(20, '600', 25, 0.38),
  headline: sys(17, '600', 22, -0.41),
  body: sys(17, '400', 22, -0.41),
  callout: sys(16, '400', 21, -0.32),
  subhead: sys(15, '400', 20, -0.24),
  subheadBold: sys(15, '600', 20, -0.24),
  footnote: sys(13, '400', 18, -0.08),
  footnoteBold: sys(13, '600', 18, -0.08),
  caption: sys(12, '400', 16, 0),
  captionBold: sys(12, '600', 16, 0),
  /** etichetta minuscola tutta maiuscola sopra un gruppo di lista */
  groupLabel: { ...sys(13, '400', 18, 0.5) },

  /** numeri sportivi: condensata, per punteggi e contatori */
  score: { fontFamily: font.displayBlack, fontSize: 44, lineHeight: 46, letterSpacing: -1 },
  scoreSm: { fontFamily: font.displayBlack, fontSize: 24, lineHeight: 26 },
  number: { fontFamily: font.displayBlack, fontSize: 30, lineHeight: 32 },
  numberSm: { fontFamily: font.display, fontSize: 19, lineHeight: 22 },
} as const;

/** Le ombre in modalita scura non si vedono: la profondita la fa il colore della superficie. */
export const shadow = {
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    default: {},
  }) as object,
} as const;

/** Altezza standard di una riga di lista iOS. */
export const ROW_HEIGHT = 44;

/**
 * Sfumature per i blocchi d'impatto: schede partita, ritratti giocatore, prodotti.
 * Servono a dare peso alle poche cose che devono saltare all'occhio, non a
 * colorare la pagina intera.
 */
export const gradients = {
  /** rosso del club, dal chiaro allo scuro */
  club: ['#E01B24', '#A70E16', '#5C070C'] as const,
  /** nero caldo per i ritratti: lascia respirare la sagoma davanti */
  portrait: ['#3A2226', '#1C1416', '#0A0709'] as const,
  /** verde del prato per il campo in prospettiva */
  pitch: ['#2A8C45', '#1B6B32'] as const,
  /** grigio chiaro per le foto prodotto scontornate su bianco */
  product: ['#FFFFFF', '#E8E6E2'] as const,
  /** velatura scura da sovrapporre alle foto per far leggere il testo */
  scrim: ['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.88)'] as const,
} as const;

/** Tinte di reparto: distinguono i ruoli senza usare scritte. */
export const roleTint: Record<string, readonly [string, string]> = {
  P: ['#2E6B4F', '#12281E'],
  D: ['#2B4F7A', '#101E2E'],
  C: ['#6B4A1F', '#291C0C'],
  A: ['#7A2130', '#2C0C12'],
};
