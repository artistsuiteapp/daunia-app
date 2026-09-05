/**
 * Invio di una notifica web push, con Web Crypto e niente altro.
 *
 * Le librerie pronte per Node non girano bene nel runtime delle Edge Function,
 * quindi il protocollo e implementato qui: sono due pezzi, la firma VAPID
 * (RFC 8292) e la cifratura del contenuto (RFC 8291, aes128gcm).
 *
 * Non e codice da inventare a mano due volte: sta in un file suo, si legge una
 * volta e poi si usa.
 */

const enc = new TextEncoder();

const b64url = (b: ArrayBuffer | Uint8Array): string => {
  const a = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (const x of a) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const daB64url = (s: string): Uint8Array => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob(t);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const unisci = (...parti: Uint8Array[]): Uint8Array => {
  const n = parti.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let i = 0;
  for (const p of parti) { out.set(p, i); i += p.length; }
  return out;
};

/** Il token che dice al servizio push chi sta mandando (RFC 8292). */
async function firmaVapid(origine: string, jwk: JsonWebKey, contatto: string): Promise<string> {
  const chiave = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  const testa = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corpo = b64url(enc.encode(JSON.stringify({
    aud: origine,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: contatto,
  })));
  const daFirmare = `${testa}.${corpo}`;
  const firma = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, chiave, enc.encode(daFirmare),
  );
  return `${daFirmare}.${b64url(firma)}`;
}

async function hkdf(sale: Uint8Array, ikm: Uint8Array, info: Uint8Array, lunghezza: number) {
  const base = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bit = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: sale as BufferSource, info: info as BufferSource },
    base,
    lunghezza * 8,
  );
  return new Uint8Array(bit);
}

/** Cifra il contenuto per un solo destinatario (RFC 8291, schema aes128gcm). */
async function cifra(testo: string, p256dh: string, auth: string): Promise<Uint8Array> {
  const chiaveCliente = daB64url(p256dh);
  const segretoCliente = daB64url(auth);

  // una coppia di chiavi usa e getta, diversa per ogni notifica
  const effimera = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  ) as CryptoKeyPair;
  const pubEffimera = new Uint8Array(await crypto.subtle.exportKey('raw', effimera.publicKey));

  const pubCliente = await crypto.subtle.importKey(
    'raw', chiaveCliente as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );
  const condiviso = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: pubCliente }, effimera.privateKey, 256,
  ));

  const prk = await hkdf(
    segretoCliente,
    condiviso,
    unisci(enc.encode('WebPush: info\0'), chiaveCliente, pubEffimera),
    32,
  );

  const sale = crypto.getRandomValues(new Uint8Array(16));
  const chiaveAes = await hkdf(sale, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sale, prk, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', chiaveAes as BufferSource, 'AES-GCM', false, ['encrypt']);
  // il padding minimo previsto dallo schema: un solo byte 0x02 in coda
  const dati = unisci(enc.encode(testo), new Uint8Array([2]));
  const cifrato = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource }, aes, dati as BufferSource,
  ));

  // intestazione: sale (16) + dimensione record (4) + lunghezza chiave (1) + chiave
  const dimensione = new Uint8Array(4);
  new DataView(dimensione.buffer).setUint32(0, 4096);
  return unisci(sale, dimensione, new Uint8Array([pubEffimera.length]), pubEffimera, cifrato);
}

export type Iscrizione = { endpoint: string; p256dh: string; auth: string };

/**
 * Manda una notifica. Torna lo stato HTTP, che al chiamante serve per capire
 * se l'iscrizione e morta: 404 e 410 vogliono dire che quel telefono non c'e
 * piu e la riga va cancellata.
 */
export async function manda(
  iscrizione: Iscrizione,
  contenuto: unknown,
  jwk: JsonWebKey,
  chiavePubblica: string,
  contatto: string,
): Promise<number> {
  const origine = new URL(iscrizione.endpoint).origin;
  const jwt = await firmaVapid(origine, jwk, contatto);
  const corpo = await cifra(JSON.stringify(contenuto), iscrizione.p256dh, iscrizione.auth);

  const r = await fetch(iscrizione.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${chiavePubblica}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'high',
    },
    body: corpo as BodyInit,
  });
  return r.status;
}
