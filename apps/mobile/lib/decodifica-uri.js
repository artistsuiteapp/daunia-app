'use strict';

/*
 * Decodifica di un pezzo di indirizzo, al posto di `decode-uri-component`.
 *
 * expo-router legge i parametri degli indirizzi con query-string, che usa
 * decode-uri-component 0.2.2. Su un indirizzo con sequenze UTF-8 spezzate
 * quella versione lavora in tempo piu che quadratico: misurato, 1.440
 * caratteri tengono fermo il telefono tre secondi, e ogni raddoppio quadruplica
 * l'attesa. Basta un collegamento `daunia://` costruito apposta per bloccare
 * l'app (avviso GitHub, gravita media).
 *
 * La versione corretta (0.5.0) e solo modulo ES, e query-string 7 la carica con
 * require() e la chiama come funzione: aggiornarla romperebbe la navigazione.
 * Quindi Metro, dentro l'app, carica questo file al suo posto
 * (metro.config.js).
 *
 * Stesso contratto dell'originale: i "+" diventano spazi, un testo valido si
 * decodifica uguale, un testo che non e una stringa lancia TypeError. Sulle
 * sequenze rotte si decodifica quello che si puo, un carattere alla volta, e i
 * byte che non formano un carattere restano scritti come sono. Tempo lineare.
 */

var SEQUENZA = /(?:%[0-9a-f]{2})+/gi;

/** Quanti byte occupa il carattere che comincia con questo byte, 0 se nessuno. */
function lunghezza(primo) {
  if (primo < 0x80) return 1;
  if (primo >= 0xc2 && primo <= 0xdf) return 2;
  if (primo >= 0xe0 && primo <= 0xef) return 3;
  if (primo >= 0xf0 && primo <= 0xf4) return 4;
  return 0;
}

function decodificaSequenza(tratto) {
  var byte = tratto.match(/%[0-9a-f]{2}/gi);
  var fuori = '';
  var i = 0;
  while (i < byte.length) {
    var quanti = lunghezza(parseInt(byte[i].slice(1), 16));
    if (quanti > 0 && i + quanti <= byte.length) {
      try {
        fuori += decodeURIComponent(byte.slice(i, i + quanti).join(''));
        i += quanti;
        continue;
      } catch (e) {
        // non forma un carattere: si lascia il primo byte com'e e si va avanti
      }
    }
    fuori += byte[i];
    i += 1;
  }
  return fuori;
}

module.exports = function decodificaUri(encodedURI) {
  if (typeof encodedURI !== 'string') {
    throw new TypeError('Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`');
  }
  var testo = encodedURI.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(testo);
  } catch (e) {
    return testo.replace(SEQUENZA, decodificaSequenza);
  }
};
