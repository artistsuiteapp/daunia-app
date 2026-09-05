/**
 * Identita del progetto, in un file solo.
 *
 * Questa e la versione NON UFFICIALE, pensata per stare online e per una
 * raccolta fondi. Regole che valgono qui e che non vanno aggirate:
 *
 * - Il nome del club si puo scrivere solo in forma descrittiva ("app non
 *   ufficiale per i tifosi del Calcio Foggia 1920"). Mai come nome del prodotto.
 * - Stemma, marchio figurativo e soprannomi del club non si usano, e non si
 *   usano nemmeno segni che gli somiglino.
 * - Rosso e nero restano: un colore non e registrabile come marchio.
 *
 * Il prototipo con stemma e nome del club vive separato in ~/dev/satanelli-app
 * ed e materiale da mostrare alla societa, non da pubblicare.
 */
export const brand = {
  /** false = versione pubblica non affiliata. Qui non deve mai diventare true. */
  official: false,

  name: 'Il Tifo della Daunia',
  /** forma corta, per gli spazi stretti */
  shortName: 'Il Tifo',
  /** Nominato solo in testi descrittivi, mai come marchio del prodotto. */
  clubName: 'Calcio Foggia 1920',
  tagline: "L'app dei tifosi rossoneri",
  city: 'Foggia',

  colors: {
    red: '#CC1111',
    redBright: '#EE1111',
    black: '#111111',
    white: '#FFFFFF',
  },

  disclaimer: 'Progetto indipendente di tifosi. Non affiliato al Calcio Foggia 1920, che non lo sostiene ne lo approva.',

  /** Descrizione breve, da riusare nelle pagine legali e nella raccolta fondi. */
  about: 'App non ufficiale per i tifosi del Calcio Foggia 1920, fatta da tifosi. Dati sportivi da fonti pubbliche.',

  ticketProvider: {
    name: 'Vivaticket',
    /** Collegamento in uscita al canale ufficiale. Mai vendita, mai affiliazione. */
    url: 'https://calciofoggia1920.vivaticket.it/',
  },

  officialSite: 'https://www.calciofoggia1920.net',

  demoUser: { name: 'Mario Rossi' },
} as const;
