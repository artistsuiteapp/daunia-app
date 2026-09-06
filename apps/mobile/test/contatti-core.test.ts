import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { numeroWhatsapp, nomeUtente, collegamento, etichetta, valido } from '../lib/contatti-core.ts';

test('i numeri italiani scritti come capita finiscono tutti nella stessa forma', () => {
  for (const n of ['349 123 4567', '+39 3491234567', '0039 349 1234567', '349-123-4567', '3491234567']) {
    assert.equal(numeroWhatsapp(n), '393491234567', `sbagliato su ${n}`);
  }
});

test('un numero estero col prefisso passa comunque', () => {
  assert.equal(numeroWhatsapp('+49 170 1234567'), '491701234567');
  assert.equal(numeroWhatsapp('+41 79 1234567'), '41791234567');
});

test('su un numero che non torna non si tira a indovinare', () => {
  // meglio nessun pulsante che un pulsante che apre una chat con uno
  // sconosciuto perche mancava una cifra
  assert.equal(numeroWhatsapp('12345'), null);
  assert.equal(numeroWhatsapp('ciao'), null);
  assert.equal(numeroWhatsapp(''), null);
  assert.equal(numeroWhatsapp('06 1234567'), null);
});

test('i nomi utente si ripuliscono da chiocciola e indirizzo', () => {
  assert.equal(nomeUtente('@marco_fg', 't\\.me'), 'marco_fg');
  assert.equal(nomeUtente('https://t.me/marco_fg', 't\\.me'), 'marco_fg');
  assert.equal(nomeUtente('t.me/marco_fg/', 't\\.me'), 'marco_fg');
  assert.equal(nomeUtente('instagram.com/marco.fg', 'instagram\\.com'), 'marco.fg');
});

test('un nome utente impossibile non passa', () => {
  assert.equal(nomeUtente('ab', 't\\.me'), null);
  assert.equal(nomeUtente('con spazi', 't\\.me'), null);
  assert.equal(nomeUtente('', 't\\.me'), null);
});

test('i collegamenti sono quelli che aprono l applicazione giusta', () => {
  assert.equal(collegamento('whatsapp', '349 1234567'), 'https://wa.me/393491234567');
  assert.equal(collegamento('telegram', '@marco_fg'), 'https://t.me/marco_fg');
  assert.equal(collegamento('instagram', '@marco.fg'), 'https://instagram.com/marco.fg');
  assert.equal(collegamento('email', 'marco@posta.it'), 'mailto:marco@posta.it');
});

test('un indirizzo email storto non produce un pulsante', () => {
  assert.equal(collegamento('email', 'marco@posta'), null);
  assert.equal(collegamento('email', 'chiocciola mancante'), null);
  assert.equal(valido('email', 'marco@posta.it'), true);
  assert.equal(valido('email', 'marco'), false);
});

test('l etichetta non mostra il contatto per intero', () => {
  // chi deve scrivere preme il pulsante; il numero intero a schermo lo legge
  // anche chi sta solo guardando
  assert.equal(etichetta('whatsapp', '349 1234567'), 'WhatsApp · ···4567');
  assert.equal(etichetta('email', 'marco@posta.it'), 'Email · m···@posta.it');
  assert.equal(etichetta('telegram', '@marco_fg'), 'Telegram · @marco_fg');
});
