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

/**
 * Carattere di marca: Montserrat, geometrico, con i pesi alti e il corsivo che
 * riprendono la scritta del logo. Sostituisce il carattere di sistema ovunque.
 *
 * Con un carattere caricato a mano fontWeight non basta: React Native sceglie
 * il file dal nome della famiglia, quindi ogni peso ha il suo nome e il peso
 * numerico serve solo come ripiego sul web finche il file non e pronto.
 */
export const font = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  black: 'Montserrat_800ExtraBold',
  /** i numeri sportivi e i titoli d'impatto: corsivo, come sul logo */
  displayItalic: 'Montserrat_800ExtraBold_Italic',
  boldItalic: 'Montserrat_700Bold_Italic',
} as const;

const FAMILY: Record<'400' | '500' | '600' | '700', string> = {
  '400': font.regular,
  '500': font.medium,
  '600': font.semibold,
  '700': font.bold,
};

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

  /*
   * Contrasto misurato, non a occhio: l'app la usa soprattutto chi ha piu di
   * 45 anni. Il vecchio textFaint (opacita 0,32) stava a 2,4:1 sul nero, sotto
   * il 4,5:1 che le linee guida Apple chiedono per il testo fino a 17 punti, ed
   * era il colore di note, messaggi vuoti e sottotitoli. Ora il piu tenue sta
   * sopra 5,2:1 anche sulla superficie piu chiara.
   */
  text: '#FFFFFF',
  /** secondario: da 8:1 in su su tutti gli sfondi */
  textDim: 'rgba(235,235,245,0.80)',
  /** terziario: da 5,2:1 in su su tutti gli sfondi */
  textFaint: 'rgba(235,235,245,0.62)',

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


const sys = (size: number, weight: '400' | '500' | '600' | '700', lineHeight: number, letterSpacing = 0) => ({
  fontFamily: FAMILY[weight],
  fontSize: size,
  lineHeight,
  letterSpacing,
});

/**
 * Scala tipografica di iOS, alla taglia xLarge.
 *
 * I nomi seguono quelli di sistema, cosi e chiaro il ruolo di ogni stile. Le
 * misure sono quelle che Apple usa un gradino sopra la taglia standard (corpo
 * 19 invece di 17): l'app la apriranno soprattutto persone sopra i 45 anni, e
 * con la taglia standard lo stile piu usato in tutta l'app era una didascalia
 * da 12 punti. Sopra questa base il testo cresce ancora con l'impostazione di
 * sistema, che non e bloccata da nessuna parte.
 *
 * Il piu piccolo e 14, sopra gli 11 minimi delle linee guida. Niente pesi
 * sottili: Montserrat parte dal Regular.
 */
export const type = {
  largeTitle: sys(36, '700', 43, 0.37),
  title1: sys(30, '700', 37, 0.36),
  title2: sys(24, '700', 30, 0.35),
  title3: sys(22, '600', 28, 0.38),
  headline: sys(19, '600', 24, -0.41),
  body: sys(19, '400', 25, -0.41),
  callout: sys(18, '400', 23, -0.32),
  subhead: sys(17, '400', 23, -0.24),
  subheadBold: sys(17, '600', 23, -0.24),
  footnote: sys(15, '400', 21, -0.08),
  footnoteBold: sys(15, '600', 21, -0.08),
  caption: sys(14, '400', 19, 0),
  captionBold: sys(14, '600', 19, 0),
  /** etichetta sopra un gruppo di lista: in minuscolo normale, come in iOS 16+ */
  groupLabel: { ...sys(17, '600', 23, 0) },

  /** numeri sportivi e cifre d'impatto: corsivo pesante, come la scritta del logo */
  score: { fontFamily: font.displayItalic, fontSize: 42, lineHeight: 48, letterSpacing: -0.5 },
  scoreSm: { fontFamily: font.displayItalic, fontSize: 24, lineHeight: 29 },
  number: { fontFamily: font.displayItalic, fontSize: 29, lineHeight: 35 },
  numberSm: { fontFamily: font.boldItalic, fontSize: 20, lineHeight: 25 },
  /** titolo d'apertura di una schermata: corsivo, per staccare dal corpo */
  displayTitle: { fontFamily: font.displayItalic, fontSize: 34, lineHeight: 41, letterSpacing: -0.4 },
} as const;

/** Le ombre in modalita scura non si vedono: la profondita la fa il colore della superficie. */
export const shadow = {
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    default: {},
  }) as object,
} as const;

/**
 * Altezza minima di una riga di lista.
 *
 * Il valore di iOS e 44, che e anche il bersaglio minimo per un dito. Con il
 * testo piu grande e un pubblico che tocca con meno precisione, 52 lascia
 * margine senza allungare troppo le liste.
 */
export const ROW_HEIGHT = 52;

/** Il bersaglio tattile minimo delle linee guida Apple: 44 x 44 punti. */
export const TOCCO_MINIMO = 44;

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
