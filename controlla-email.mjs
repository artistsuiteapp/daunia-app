#!/usr/bin/env node
/**
 * Controlla se un dominio e pronto a spedire con Resend.
 *
 *   node controlla-email.mjs mail.iltuodominio.it
 *
 * Serve a rispondere prima, non dopo: i record DNS ci mettono da pochi minuti a
 * qualche ora a propagarsi, e senza un modo di guardarli si finisce a premere
 * "verifica" su Resend ogni due minuti senza sapere se il problema e l'attesa o
 * un record scritto male.
 *
 * DOVE VANNO I RECORD, che e la cosa che si sbaglia
 *
 * Resend non li mette tutti sullo stesso nome:
 *   SPF e MX   ->  send.<dominio>
 *   DKIM       ->  resend._domainkey.<dominio>
 *   DMARC      ->  _dmarc.<dominio>
 *
 * Cercarli tutti sul dominio nudo fa dire "manca" a una configurazione giusta.
 *
 * Zero dipendenze: usa il resolver DNS di Node.
 */
import { Resolver } from 'node:dns/promises';

const dominio = process.argv[2];
if (!dominio) {
  console.error('Uso: node controlla-email.mjs mail.iltuodominio.it');
  console.error('     (il nome esatto che hai aggiunto su Resend)');
  process.exit(1);
}

// resolver pubblico invece di quello del sistema: la cache del provider di casa
// puo restituire il "non esiste" di mezz'ora fa e far sembrare rotto un record
// che invece e gia a posto
const dns = new Resolver();
dns.setServers(['1.1.1.1', '8.8.8.8']);

const ok = (t) => console.log(`  \x1b[32m✓\x1b[0m ${t}`);
const no = (t) => { console.log(`  \x1b[31m✗\x1b[0m ${t}`); return 1; };
const forse = (t) => console.log(`  \x1b[33m•\x1b[0m ${t}`);
const dettaglio = (t) => console.log(`    ${t}`);

const txt = async (n) => {
  try { return (await dns.resolveTxt(n)).map((r) => r.join('')); } catch { return []; }
};
const mx = async (n) => {
  try { return await dns.resolveMx(n); } catch { return []; }
};

console.log(`\nControllo ${dominio}\n`);
let problemi = 0;

// --- SPF, su send.<dominio> ---
const nomeSpf = `send.${dominio}`;
const spf = (await txt(nomeSpf)).filter((r) => r.toLowerCase().startsWith('v=spf1'));

if (!spf.length) {
  problemi += no(`SPF assente su ${nomeSpf}`);
  dettaglio('Record TXT, nome "send", valore: v=spf1 include:amazonses.com ~all');
  const suRadice = (await txt(dominio)).filter((r) => r.toLowerCase().startsWith('v=spf1'));
  if (suRadice.length) {
    dettaglio(`Ce n'e uno su ${dominio}: e nel posto sbagliato, va su "send".`);
  }
} else if (spf.length > 1) {
  // due SPF sullo stesso nome sono peggio di nessuno: i destinatari li
  // considerano un errore di configurazione e il controllo fallisce
  problemi += no(`SPF doppio su ${nomeSpf} (${spf.length} record): vanno uniti in uno solo.`);
} else if (!/amazonses/i.test(spf[0])) {
  problemi += no(`SPF su ${nomeSpf} non include amazonses: ${spf[0]}`);
} else {
  ok(`SPF a posto su ${nomeSpf}`);
}

// --- MX, sullo stesso nome: serve a Resend per i rimbalzi ---
const rec = await mx(nomeSpf);
if (!rec.some((r) => /amazonses/i.test(r.exchange))) {
  problemi += no(`MX assente su ${nomeSpf}`);
  dettaglio('Record MX, nome "send", priorita 10, valore: feedback-smtp.<regione>.amazonses.com');
} else {
  ok(`MX a posto su ${nomeSpf}`);
}

// --- DKIM, sul dominio ---
const nomeDkim = `resend._domainkey.${dominio}`;
const dkim = await txt(nomeDkim);
if (!dkim.length) {
  problemi += no(`DKIM assente su ${nomeDkim}`);
  dettaglio('Record TXT, nome "resend._domainkey", valore: quello lungo che ti da Resend');
} else if (!/p=[A-Za-z0-9+/]{40,}/.test(dkim.join(''))) {
  problemi += no('DKIM presente ma la chiave sembra tagliata.');
  dettaglio('I record DKIM sono lunghi e certi pannelli DNS li troncano: va incollato per intero.');
} else {
  ok('DKIM a posto');
}

// --- DMARC: non blocca Resend, ma lo chiedono Gmail e Yahoo ---
const dmarc = (await txt(`_dmarc.${dominio}`)).filter((r) => r.toLowerCase().startsWith('v=dmarc1'));
if (!dmarc.length) {
  forse(`DMARC assente su _dmarc.${dominio}`);
  dettaglio('Non blocca la verifica di Resend, ma dal 2024 Gmail e Yahoo lo vogliono.');
  dettaglio('Il minimo che serve: v=DMARC1; p=none;');
} else {
  ok(`DMARC presente (${dmarc[0].match(/p=(\w+)/)?.[1] ?? '?'})`);
}

console.log(
  problemi === 0
    ? '\nPronto: vai su Resend e premi "verifica".\n'
    : `\n${problemi === 1 ? 'Manca una cosa' : `Mancano ${problemi} cose`}. Se i record li hai appena messi, aspetta e riprova: la propagazione puo richiedere ore.\n`,
);
process.exit(problemi === 0 ? 0 : 1);
