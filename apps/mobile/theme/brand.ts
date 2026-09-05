/**
 * Identita di marca in un file solo.
 * Serve al pitch (versione con stemma e colori del club) e alla via di riserva
 * (versione indipendente senza marchio, se il club non firma): si cambia qui e basta.
 *
 * I colori sono campionati dallo stemma ufficiale, non scelti a occhio.
 */
export const brand = {
  /** true = demo privata per il club. Mai true in una build pubblicata sugli store. */
  official: true,

  name: 'Satanelli',
  clubName: 'Calcio Foggia 1920',
  tagline: 'I Satanelli, ogni giorno',
  nickname: 'Satanelli',
  city: 'Foggia',

  colors: {
    red: '#CC1111',
    redBright: '#EE1111',
    black: '#111111',
    white: '#FFFFFF',
  },

  /** Mostrato quando official = false: obbligatorio per una build fan-made. */
  disclaimer: 'App non ufficiale, non affiliata al Calcio Foggia 1920.',

  ticketProvider: {
    name: 'Vivaticket',
    url: 'https://calciofoggia1920.vivaticket.it/',
  },

  officialSite: 'https://www.calciofoggia1920.net',

  /** Utente di esempio per la demo: nell'app vera arriva dal profilo. */
  demoUser: { name: 'Mario Rossi' },
} as const;
