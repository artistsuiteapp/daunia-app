import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { erroreRecupero, parametriRecupero } from '../lib/recupero-core.ts';

test('il collegamento dell email sul telefono porta i dati dopo il cancelletto', () => {
  const p = parametriRecupero('daunia://nuova-password#access_token=aaa.bbb.ccc&expires_in=3600&refresh_token=rrr&token_type=bearer&type=recovery');
  assert.deepEqual(p, { accesso: 'aaa.bbb.ccc', rinnovo: 'rrr', codice: null, tipo: 'recovery', errore: null });
});

test('il flusso con il codice passa dalla query', () => {
  const p = parametriRecupero('https://daunia.vercel.app/nuova-password?code=abc-123');
  assert.equal(p.codice, 'abc-123');
  assert.equal(p.accesso, null);
});

test('un collegamento scaduto dice di chiederne un altro', () => {
  const p = parametriRecupero('daunia://nuova-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  assert.equal(p.errore, 'Email link is invalid or has expired');
  assert.match(erroreRecupero(p) ?? '', /scaduto/);
});

test('senza indirizzo o con pezzi rotti non si inventa niente', () => {
  const vuoto = { accesso: null, rinnovo: null, codice: null, tipo: null, errore: null };
  assert.deepEqual(parametriRecupero(null), vuoto);
  assert.deepEqual(parametriRecupero('daunia://nuova-password'), vuoto);
  const rotto = parametriRecupero('daunia://x#access_token=%E0%A4%A&refresh_token=rrr');
  assert.equal(rotto.accesso, null);
  assert.equal(rotto.rinnovo, 'rrr');
  assert.equal(erroreRecupero(vuoto), null);
});
