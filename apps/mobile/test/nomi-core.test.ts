import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { nomeSulCampo } from '../lib/nomi-core.ts';

test('i nomi corti restano interi', () => {
  assert.equal(nomeSulCampo('Bigonzoni'), 'Bigonzoni');
  assert.equal(nomeSulCampo('Saro'), 'Saro');
  assert.equal(nomeSulCampo('F. Tosi'), 'F. Tosi');
});

test('un nome lungo diventa il cognome', () => {
  assert.equal(nomeSulCampo('Pio Petito'), 'Petito');
  assert.equal(nomeSulCampo('Mamadou Coulibaly'), 'Coulibaly');
  assert.equal(nomeSulCampo('M. Coulibaly'), 'Coulibaly');
});

test('le particelle restano attaccate al cognome', () => {
  assert.equal(nomeSulCampo('Gianluca De Luca'), 'De Luca');
  assert.equal(nomeSulCampo('Ferdinando Del Sole'), 'Del Sole');
  assert.equal(nomeSulCampo('Virgil van Dijk'), 'van Dijk');
});

test('senza nome si mette un trattino', () => {
  assert.equal(nomeSulCampo(null), '—');
  assert.equal(nomeSulCampo('   '), '—');
});
