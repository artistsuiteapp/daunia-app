import { test } from 'node:test';
import assert from 'node:assert/strict';

import { apribile } from '../lib/apri-core.ts';

test('gli indirizzi web passano', () => {
  assert.equal(apribile('https://calciofoggia.it/articolo'), true);
  assert.equal(apribile('http://esempio.it'), true);
  assert.equal(apribile('  https://esempio.it/x  '), true, 'gli spazi intorno non contano');
  assert.equal(apribile('HTTPS://ESEMPIO.IT'), true, 'lo schema non e sensibile alle maiuscole');
});

test('gli schemi che escono dal browser non passano', () => {
  // il punto della funzione: Linking.openURL li consegnerebbe a chi li ha registrati
  assert.equal(apribile('tel:+390881123456'), false);
  assert.equal(apribile('sms:+390881123456'), false);
  assert.equal(apribile('mailto:tizio@esempio.it'), false);
  assert.equal(apribile('intent://scan#Intent;scheme=zxing;end'), false);
  assert.equal(apribile('daunia://admin'), false, 'nemmeno il nostro schema');
  assert.equal(apribile('file:///etc/passwd'), false);
});

test('javascript: non passa, e non basta chiedere a new URL se e valido', () => {
  // new URL('javascript:alert(1)') non lancia: torna un URL con protocollo javascript:
  assert.equal(apribile('javascript:alert(1)'), false);
  assert.equal(apribile('data:text/html,<script>alert(1)</script>'), false);
});

test('quello che non e una stringa non passa', () => {
  assert.equal(apribile(null), false);
  assert.equal(apribile(undefined), false);
  assert.equal(apribile(''), false);
  assert.equal(apribile('   '), false);
  assert.equal(apribile(42), false);
  assert.equal(apribile({ href: 'https://esempio.it' }), false);
});

test('un indirizzo relativo o senza host non passa', () => {
  assert.equal(apribile('/articolo/123'), false);
  assert.equal(apribile('esempio.it'), false);
  assert.equal(apribile('https://'), false);
});
