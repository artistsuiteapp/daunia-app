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

/** length e depth in metri, offset dalla linea di centrocampo lungo l'asse perpendicolare. */
const SECTORS = [
  {
    id: 'tribuna-centrale', name: 'Tribuna Ovest', side: 'west',
    capacity: 3200, covered: true, priceFrom: 28, priceTo: 50,
    note: 'Si divide in Centralissima, Centrale e Laterale Superiore, Inferiore Centrale e Laterale.',
    geometry: { length: 112, depth: 22, rows: 30, baseHeight: 1.5, topHeight: 14, offset: 42 },
  },
  {
    id: 'tribuna-est', name: 'Tribuna Est (Distinti)', side: 'east',
    capacity: 4100, covered: false, priceFrom: 22, reduced: 17,
    geometry: { length: 112, depth: 19, rows: 26, baseHeight: 1.2, topHeight: 12, offset: 42 },
  },
  {
    id: 'curva-nord', name: 'Curva Nord', side: 'north',
    capacity: 3800, covered: false, priceFrom: null, soldOut: true,
    note: 'Esaurita con gli abbonamenti: mille posti andati in prelazione.',
    geometry: { length: 74, depth: 21, rows: 28, baseHeight: 1.2, topHeight: 13, offset: 62 },
  },
  {
    id: 'curva-sud', name: 'Curva Sud', side: 'south',
    capacity: 2400, covered: false, priceFrom: null, soldOut: true,
    note: 'Esaurita con gli abbonamenti: duemila posti andati in prelazione.',
    geometry: { length: 52, depth: 21, rows: 28, baseHeight: 1.2, topHeight: 13, offset: 62, shift: -11 },
  },
  {
    id: 'settore-ospiti', name: 'Settore Ospiti', side: 'south',
    capacity: 1030, covered: false, priceFrom: 12,
    note: 'Riservato ai tifosi ospiti, in vendita solo nella loro citta.',
    geometry: { length: 22, depth: 21, rows: 28, baseHeight: 1.2, topHeight: 13, offset: 62, shift: 26 },
  },
];

/**
 * Riempimento simulato, deterministico rispetto alla partita cosi la demo e stabile
 * fra un refresh e l'altro. Va sostituito dal dato Vivaticket appena il club lo apre.
 */
function simulateOccupancy(sectorId, match) {
  if (!match) return null;
  const seed = [...`${sectorId}${match.id}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const jitter = (seed % 1000) / 1000;
  const base = { 'curva-nord': 0.82, 'curva-sud': 0.55, 'tribuna-centrale': 0.62, 'tribuna-est': 0.7, 'settore-ospiti': 0.35 }[sectorId] ?? 0.5;
  const derby = /cerignola|bari|lecce|salernitana|crotone|catania/i.test(`${match.homeName} ${match.awayName}`) ? 0.15 : 0;
  return Math.min(0.99, Math.max(0.05, base + derby + (jitter - 0.5) * 0.18));
}

export function buildStadium(nextHomeMatch, capacityFromWiki) {
  const capacity = capacityFromWiki || ZACCHERIA_CAPACITY;
  return {
    name: 'Stadio Pino Zaccheria',
    city: 'Foggia',
    capacity,
    capacityIsEstimated: false,
    pitch: { length: 105, width: 68 },
    ticketUrl: TICKETS,
    priceNote: 'I prezzi cambiano a ogni partita: questi sono quelli dell\'ultima gara in casa. Quello valido e sempre il prezzo su Vivaticket.',
    sectors: SECTORS.map((s) => ({
      ...s,
      currency: 'EUR',
      capacityIsEstimated: true,
      priceIsIndicative: true,
      occupancy: simulateOccupancy(s.id, nextHomeMatch),
      occupancyIsSimulated: true,
      ticketUrl: TICKETS,
    })),
  };
}
