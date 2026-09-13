import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { titoloLeggibile, tuttoMaiuscolo } from '../lib/titoli-core.ts';

test('i titoli in maiuscolo diventano leggibili senza perdere i nomi', () => {
  assert.equal(titoloLeggibile('DALL’ATALANTA ARRIVA FEDERICO ZUCCON'), 'Dall’Atalanta Arriva Federico Zuccon');
  assert.equal(titoloLeggibile('FOGGIA-SAVOIA: INFO TAGLIANDI'), 'Foggia-Savoia: Info Tagliandi');
  assert.equal(
    titoloLeggibile('MAESTRELLI, SMERALDI, CHIARA, MIU E PAOLINO A DISPOSIZIONE DI AUTERI'),
    'Maestrelli, Smeraldi, Chiara, Miu e Paolino a Disposizione di Auteri',
  );
  assert.equal(titoloLeggibile('BERRA È UN NUOVO GIOCATORE DEL FOGGIA'), 'Berra è un Nuovo Giocatore del Foggia');
});

test('la prima parola e quella dopo i due punti hanno sempre la maiuscola', () => {
  assert.equal(titoloLeggibile('IN ATTACCO ARRIVA LUCIANI'), 'In Attacco Arriva Luciani');
  assert.equal(titoloLeggibile('COMUNICATO: IL CLUB INFORMA I TIFOSI'), 'Comunicato: Il Club Informa i Tifosi');
});

test('sigle con cifre restano come sono', () => {
  assert.equal(titoloLeggibile('INTER U23-FOGGIA: INFO TAGLIANDI'), 'Inter U23-Foggia: Info Tagliandi');
});

test('un titolo scritto normalmente non si tocca', () => {
  const t = 'Il primo mese di Auteri, letto dai numeri';
  assert.equal(titoloLeggibile(t), t);
  assert.equal(tuttoMaiuscolo('FCM'), false);
  assert.equal(titoloLeggibile(null), '');
});
