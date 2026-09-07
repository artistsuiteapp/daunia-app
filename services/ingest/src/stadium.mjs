/**
 * Modello dello stadio Pino Zaccheria.
 *
 * Geometria ricavata dalle due foto aeree in assets/stadium: vasca rettangolare,
 * quattro tribune staccate, angoli aperti, tetto solo sulla Tribuna Centrale.
 * Capienza 14.530, valore dichiarato da Wikipedia per la stagione in corso
 * (i 25.085 che girano in rete sono la capienza storica prima delle riduzioni).
 *
 * Le capienze per settore sono STIME, segnalate come tali: il club non pubblica
 * il dettaglio.
 *
 * I PREZZI CAMBIANO A OGNI PARTITA. Quelli qui sotto vengono dal listino di
 * Foggia-Audace Cerignola del 6 settembre 2026, e sono l'ultimo dato certo. Per
 * la stessa Tribuna Est si sono visti 18 e 22 euro in due gare diverse, quindi
 * un numero fisso qui e per definizione approssimativo: e scritto anche nell'app.
 *
 * La Tribuna Ovest allo Zaccheria non e un settore solo. Si divide in
 * Centralissima, Centrale Superiore, Laterale Superiore, Inferiore Centrale e
 * Inferiore Laterale, da 28 a 50 euro. Il modello 3D ne fa un blocco unico
 * perche dividerlo in cinque non aggiunge niente a chi guarda: nell'app compare
 * la fascia di prezzo invece del solo minimo.
 *
 * Le due curve risultano esaurite dagli abbonamenti: duemila posti in Curva Sud
 * e mille in Curva Nord sono andati in prelazione, e per il derby entrambe erano
 * sold out. Un prezzo "da 11 euro" li era doppiamente sbagliato: cifra errata e
 * biglietti inesistenti.
 */

export const ZACCHERIA_CAPACITY = 14530;
const TICKETS = 'https://calciofoggia1920.vivaticket.it/';

/*
 * I settori dello Zaccheria.
 *
 * Niente prezzi, niente "esaurito", niente numeri di prelazione: erano scritti
 * a mano qui e in app uscivano come un listino aggiornato. I prezzi cambiano a
 * ogni partita e li pubblica Vivaticket; se una curva e esaurita lo dice la
 * biglietteria, non noi.
 *
 * Restano la capienza -- dichiarata come stima -- se il settore e coperto, e
 * la geometria, che serve al modello e non cambia mai.
 *
 * length e depth in metri, offset dalla linea di centrocampo lungo l'asse
 * perpendicolare.
 */
const SECTORS = [
  {
    id: 'tribuna-centrale', name: 'Tribuna Ovest', side: 'west',
    capacity: 3200, covered: true,
    note: 'Si divide in Centralissima, Centrale e Laterale Superiore, Inferiore Centrale e Laterale.',
    geometry: { length: 112, depth: 22, rows: 30, baseHeight: 1.5, topHeight: 14, offset: 42 },
  },
  {
    id: 'tribuna-est', name: 'Tribuna Est (Distinti)', side: 'east',
    capacity: 4100, covered: false,
    geometry: { length: 112, depth: 19, rows: 26, baseHeight: 1.2, topHeight: 12, offset: 42 },
  },
  {
    id: 'curva-nord', name: 'Curva Nord', side: 'north',
    capacity: 3800, covered: false,
    geometry: { length: 74, depth: 21, rows: 28, baseHeight: 1.2, topHeight: 13, offset: 62 },
  },
  {
    id: 'curva-sud', name: 'Curva Sud', side: 'south',
    capacity: 2400, covered: false,
    geometry: { length: 52, depth: 21, rows: 28, baseHeight: 1.2, topHeight: 13, offset: 62, shift: -11 },
  },
  {
    id: 'settore-ospiti', name: 'Settore Ospiti', side: 'south',
    capacity: 1030, covered: false,
    note: 'Riservato ai tifosi ospiti, in vendita solo nella loro citta.',
    geometry: { length: 22, depth: 21, rows: 28, baseHeight: 1.2, topHeight: 13, offset: 62, shift: 26 },
  },
];


export function buildStadium(nextHomeMatch, capacityFromWiki) {
  const capacity = capacityFromWiki || ZACCHERIA_CAPACITY;
  return {
    name: 'Stadio Pino Zaccheria',
    city: 'Foggia',
    capacity,
    capacityIsEstimated: false,
    pitch: { length: 105, width: 68 },
    ticketUrl: TICKETS,
    priceNote: 'I prezzi sono su Vivaticket: qui non li abbiamo.',
    sectors: SECTORS.map((s) => ({
      ...s,
      currency: 'EUR',
      capacityIsEstimated: true,
      // niente `occupancy`: era un riempimento simulato, e da li uscivano sia
      // i "posti disponibili" sia le barre nella pagina biglietti. Gli spalti
      // nel modello 3D adesso seguono solo chi ha dichiarato di andarci.
      ticketUrl: TICKETS,
    })),
  };
}
