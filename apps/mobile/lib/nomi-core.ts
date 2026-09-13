/**
 * Il nome da scrivere sotto una maglia, sul campo disegnato.
 *
 * Tre giocatori sulla stessa linea stanno a una sessantina di punti l'uno
 * dall'altro, e "Pio Petito" accanto a "Bigonzoni" si sovrapponeva. Sul campo
 * basta il cognome, come sulle maglie vere; il nome intero resta nella scheda
 * del giocatore.
 *
 * Le particelle restano attaccate al cognome: "De Luca" non diventa "Luca".
 */

const PARTICELLE = new Set([
  'de', 'di', 'da', 'del', 'della', 'dei', 'degli', 'dal', 'dalla', 'dello',
  'lo', 'la', 'le', 'li', 'van', 'von', 'der', 'den', 'dos', 'das', 'du', 'mac', 'mc', 'el', 'al', 'ben',
]);

/** Oltre questa lunghezza sul campo si tiene solo il cognome. */
export const MAX_SUL_CAMPO = 9;

export function nomeSulCampo(nome: string | null | undefined): string {
  const pulito = (nome ?? '').trim().replace(/\s+/g, ' ');
  if (!pulito) return '—';
  if (pulito.length <= MAX_SUL_CAMPO) return pulito;

  // "F. Tosi" e simili: l'iniziale puntata cade per prima
  const parole = pulito.split(' ').filter((p) => !/^\p{L}\.$/u.test(p));
  if (parole.length <= 1) return parole[0] ?? pulito;

  const ultima = parole[parole.length - 1];
  const penultima = parole[parole.length - 2];
  if (PARTICELLE.has(penultima.toLowerCase())) return `${penultima} ${ultima}`;
  return ultima;
}
