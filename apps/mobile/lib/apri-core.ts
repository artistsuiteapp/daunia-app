/**
 * Quali indirizzi si possono consegnare al sistema operativo.
 *
 * PERCHE ESISTE
 *
 * `Linking.openURL` non apre solo pagine web: consegna l'indirizzo a chi ha
 * registrato quello schema. `tel:` chiama, `sms:` scrive, su Android `intent://`
 * puo aprire un componente qualsiasi di un'altra app, e ogni app installata puo
 * registrarsi su uno schema suo.
 *
 * Finche i dati stavano cotti dentro l'app il rischio era teorico: per cambiare
 * un indirizzo serviva una compilazione. Da quando il bundle si scarica a ogni
 * apertura non lo e piu. Un indirizzo che arriva dal feed di una testata --
 * copiato dall'ingest senza guardarlo, committato dal bot senza che lo legga
 * nessuno, scaricato dall'app al primo avvio -- finirebbe dritto la dentro.
 * E `fonte_url` delle trasferte lo scrivono gli utenti.
 *
 * Quindi: solo http e https, e nient'altro. Non e una difesa contro un sito
 * ostile -- quella la fa il browser -- e' una difesa contro l'uscire dal browser.
 *
 * Nell'ingest c'e la stessa regola su `voce.link` (stampa.mjs), perche un dato
 * sporco e meglio fermarlo prima di scriverlo. Questa qui e l'ultima rete: vale
 * anche per i dati gia salvati e per quelli che arrivano da Supabase.
 */

/** Vero se l'indirizzo si puo aprire: solo pagine web, niente schemi di sistema. */
export function apribile(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const pulito = url.trim();
  if (!pulito) return false;
  /*
   * Il confronto e sul prefisso e non con `new URL()`.
   *
   * `new URL('javascript:alert(1)')` non lancia: torna un URL valido con
   * protocollo `javascript:`. Fidarsi del parser e chiedere "e valido?" quando
   * la domanda vera e "e web?".
   */
  return /^https?:\/\/[^\s]/i.test(pulito);
}
