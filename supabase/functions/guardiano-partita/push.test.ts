import { strict as assert } from 'node:assert';
import { test } from 'node:test';

/*
 * Prova della cifratura delle notifiche.
 *
 * La consegna vera non si puo provare da qui: serve un browser che si iscriva a
 * un servizio push. Ma il pezzo che rischia davvero di essere sbagliato non e
 * la consegna, e la crittografia scritta a mano.
 *
 * Quindi si fa l'altra meta: qui c'e il destinatario. Si genera una coppia di
 * chiavi come farebbe un telefono, si cifra con il codice che va in produzione,
 * e si decifra seguendo la RFC 8291. Se il testo torna uguale, il formato e
 * giusto e il telefono lo sapra leggere.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (b: Uint8Array): string => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const unisci = (...p: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(p.reduce((a, x) => a + x.length, 0));
  let i = 0;
  for (const x of p) { out.set(x, i); i += x.length; }
  return out;
};

async function hkdf(sale: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) {
  const base = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: sale as BufferSource, info: info as BufferSource },
    base, n * 8,
  ));
}

/** Il telefono: una coppia di chiavi ECDH e un segreto di autenticazione. */
async function finTelefono() {
  const coppia = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  ) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', coppia.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { coppia, pub, auth, p256dh: b64url(pub), authB64: b64url(auth) };
}

/** Il destinatario: legge il pacchetto aes128gcm e restituisce il testo. */
async function decifra(pacchetto: Uint8Array, telefono: Awaited<ReturnType<typeof finTelefono>>) {
  const sale = pacchetto.slice(0, 16);
  const lunghezzaChiave = pacchetto[20];
  const pubMittente = pacchetto.slice(21, 21 + lunghezzaChiave);
  const cifrato = pacchetto.slice(21 + lunghezzaChiave);

  const chiaveMittente = await crypto.subtle.importKey(
    'raw', pubMittente as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );
  const condiviso = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: chiaveMittente }, telefono.coppia.privateKey, 256,
  ));

  const prk = await hkdf(
    telefono.auth, condiviso,
    unisci(enc.encode('WebPush: info\0'), telefono.pub, pubMittente),
    32,
  );
  const chiaveAes = await hkdf(sale, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sale, prk, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', chiaveAes as BufferSource, 'AES-GCM', false, ['decrypt']);
  const chiaro = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource }, aes, cifrato as BufferSource,
  ));
  // in coda c'e il byte di riempimento previsto dallo schema
  return dec.decode(chiaro.slice(0, -1));
}

/*
 * `manda` fa una fetch vera, quindi qui si intercetta: non serve una rete, serve
 * il pacchetto che avrebbe spedito.
 */
async function pacchettoDi(contenuto: unknown, telefono: Awaited<ReturnType<typeof finTelefono>>) {
  const { manda } = await import('./push.ts');
  const coppiaVapid = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  ) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', coppiaVapid.privateKey);
  const pubVapid = new Uint8Array(await crypto.subtle.exportKey('raw', coppiaVapid.publicKey));

  let corpo: Uint8Array | null = null;
  let intestazioni: Headers | null = null;
  const vera = globalThis.fetch;
  globalThis.fetch = (async (_u: string, o: RequestInit) => {
    corpo = new Uint8Array(o.body as ArrayBuffer);
    intestazioni = new Headers(o.headers);
    return new Response(null, { status: 201 });
  }) as typeof fetch;

  try {
    await manda(
      { endpoint: 'https://esempio.push/abc', p256dh: telefono.p256dh, auth: telefono.authB64 },
      contenuto, jwk, b64url(pubVapid), 'https://daunia.vercel.app',
    );
  } finally {
    globalThis.fetch = vera;
  }
  return { corpo: corpo!, intestazioni: intestazioni!, chiaveVerifica: coppiaVapid.publicKey };
}

test('il telefono riesce a leggere quello che il guardiano cifra', async () => {
  const telefono = await finTelefono();
  const avviso = { titolo: 'GOL DEL FOGGIA! 1-0', testo: "24' Petito", tag: 'punteggio-1', rotta: '/' };
  const { corpo } = await pacchettoDi(avviso, telefono);

  const letto = JSON.parse(await decifra(corpo, telefono));
  assert.deepEqual(letto, avviso);
});

test('due notifiche uguali danno pacchetti diversi', async () => {
  // chiave effimera e sale nuovi ogni volta: due pacchetti identici
  // vorrebbero dire che qualcosa viene riusato, ed e un difetto grave
  const telefono = await finTelefono();
  const a = await pacchettoDi({ titolo: 'uguale' }, telefono);
  const b = await pacchettoDi({ titolo: 'uguale' }, telefono);
  assert.notDeepEqual([...a.corpo], [...b.corpo]);
});

test('accenti e apostrofi sopravvivono al giro', async () => {
  const telefono = await finTelefono();
  const avviso = { titolo: 'Però è finita così', testo: "L'undici dell'ultima volta" };
  const { corpo } = await pacchettoDi(avviso, telefono);
  assert.deepEqual(JSON.parse(await decifra(corpo, telefono)), avviso);
});

test('le intestazioni sono quelle che il servizio push si aspetta', async () => {
  const telefono = await finTelefono();
  const { intestazioni } = await pacchettoDi({ titolo: 'x' }, telefono);
  assert.equal(intestazioni.get('Content-Encoding'), 'aes128gcm');
  assert.equal(intestazioni.get('Content-Type'), 'application/octet-stream');
  assert.match(intestazioni.get('Authorization') ?? '', /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
});

test('la firma VAPID e valida e dice a chi e destinata', async () => {
  const telefono = await finTelefono();
  const { intestazioni, chiaveVerifica } = await pacchettoDi({ titolo: 'x' }, telefono);
  const jwt = (intestazioni.get('Authorization') ?? '').match(/t=([^,]+)/)?.[1] ?? '';
  const [testa, payload, firma] = jwt.split('.');

  const daB64 = (s: string) => {
    const t = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
    const raw = atob(t);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  };

  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, chiaveVerifica,
    daB64(firma) as BufferSource, enc.encode(`${testa}.${payload}`) as BufferSource,
  );
  assert.equal(ok, true, 'la firma deve verificare con la chiave pubblica VAPID');

  const corpo = JSON.parse(dec.decode(daB64(payload)));
  assert.equal(corpo.aud, 'https://esempio.push', 'aud deve essere l origine del servizio push');
  assert.ok(corpo.exp > Math.floor(Date.now() / 1000), 'il token non deve nascere scaduto');
});
