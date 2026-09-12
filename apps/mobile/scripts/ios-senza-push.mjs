/**
 * Toglie l'entitlement APNs dal progetto iOS appena generato.
 *
 * PERCHE SERVE
 *
 * `expo-notifications` mette `aps-environment` negli entitlement. Con un Apple ID
 * gratuito -- il "Personal Team" con cui si installa l'app sul proprio telefono
 * per sette giorni -- quell'entitlement non viene concesso e Xcode rifiuta la
 * firma. L'errore che si legge parla di profili di provisioning e non nomina mai
 * le notifiche, quindi si cerca per un'ora dalla parte sbagliata.
 *
 * Toglierlo non spegne niente che funzionasse: senza account a pagamento le
 * notifiche remote su iOS non arrivano comunque.
 *
 * PERCHE UNO SCRIPT E NON UN PLUGIN DI CONFIGURAZIONE
 *
 * Provato prima con `withEntitlementsPlist`, cancellando la chiave sia dal
 * `config.ios.entitlements` sia dal file. Non e servito: `expo-notifications` si
 * applica da solo per via del collegamento automatico, cioe dopo i plugin
 * elencati in app.json, e rimette la chiave a valle di qualsiasi cosa faccia il
 * plugin. Lo script gira dopo il prebuild, quando il file e gia scritto: li non
 * c'e' ordine che tenga.
 *
 * QUANDO NON DEVE GIRARE
 *
 * Con l'account sviluppatore a 99 euro l'anno le notifiche native funzionano e
 * l'entitlement serve. Allora si compila con DAUNIA_APNS=1 e questo script esce
 * senza toccare niente.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CARTELLA = 'ios';
const CHIAVE = 'aps-environment';

if (process.env.DAUNIA_APNS === '1') {
  console.log('DAUNIA_APNS=1: entitlement APNs lasciato al suo posto.');
  process.exit(0);
}

/** Gli entitlement stanno in ios/<NomeApp>/<NomeApp>.entitlements, e il nome cambia col progetto. */
function trovaEntitlements() {
  const fuori = [];
  for (const voce of readdirSync(CARTELLA, { withFileTypes: true })) {
    if (!voce.isDirectory() || voce.name === 'Pods' || voce.name === 'build') continue;
    const dentro = join(CARTELLA, voce.name);
    for (const f of readdirSync(dentro)) {
      if (f.endsWith('.entitlements')) fuori.push(join(dentro, f));
    }
  }
  return fuori;
}

const file = trovaEntitlements();
if (file.length === 0) {
  console.error(`Nessun file .entitlements sotto ${CARTELLA}/. Il prebuild e andato a buon fine?`);
  process.exit(1);
}

let tolti = 0;
for (const f of file) {
  const prima = readFileSync(f, 'utf8');
  /*
   * Si toglie la coppia <key>…</key><string>…</string> intera. Cancellare solo la
   * chiave lascerebbe il valore orfano e il plist diventerebbe illeggibile: Xcode
   * fallirebbe con un errore ancora piu oscuro di quello che stiamo evitando.
   */
  const dopo = prima.replace(
    new RegExp(`\\s*<key>${CHIAVE}</key>\\s*<string>[^<]*</string>`, 'g'),
    '',
  );
  if (dopo !== prima) {
    writeFileSync(f, dopo);
    tolti += 1;
    console.log(`${CHIAVE} tolto da ${f}`);
  }
}

if (tolti === 0) console.log(`${CHIAVE} non c'era: niente da fare.`);
