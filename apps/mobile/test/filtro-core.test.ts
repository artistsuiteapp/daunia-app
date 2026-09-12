import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { controlla, bestemmia, parolaccia, normalizza, spiegazione, maschera, oscura } from '../lib/filtro-core.ts';

/*
 * Due elenchi.
 *
 * Il primo e quello che deve passare, e conta piu dell'altro: un filtro che
 * blocca "la diocesi di Foggia" o "il cane di Dio" fa piu danni di uno che si
 * lascia sfuggire qualcosa. Se un giorno un caso qui sotto inizia a fallire,
 * la regola e diventata troppo larga e va stretta, non il contrario.
 */
const DEVE_PASSARE = [
  'Madonna ha cantato a Milano',
  'la diocesi di Foggia',
  'il cane di Dio',
  'Cristo è risorto',
  'Gesù bambino',
  'il sacramento della confessione',
  'il porco è un animale da cortile',
  'ha fatto una parata da urlo',
  'che gol di Petito al 24esimo',
  'Dionisio era un tiranno',
  'porco cane che sfortuna',
  'il maiale nero dei Nebrodi',
  'domenica si va a Catania, chi viene?',
  'ci vediamo alle 18 al casello, ho due posti',
  '',
  '   ',
];

const DEVE_BLOCCARE = [
  'dio porco',
  'porco dio',
  'dioporco',
  'porcoddio',
  'madonna puttana',
  'cristo bastardo',
  'dio boia',
  'D1O P0RC0',
  'diooooo caneeeee',
  'Dio Ladro che partita',
  'ma porco dio non ci credo',
  'd i o p o r c o',
  'dio  porco',
  'DIOPORCO',
  'dio pòrco',
];

for (const t of DEVE_PASSARE) {
  test(`passa: ${JSON.stringify(t)}`, () => {
    const e = controlla(t);
    assert.equal(e.pulito, true, `bloccato per sbaglio: ${JSON.stringify(e)}`);
  });
}

for (const t of DEVE_BLOCCARE) {
  test(`blocca: ${JSON.stringify(t)}`, () => {
    const e = controlla(t);
    assert.equal(e.pulito, false, 'passato quando non doveva');
    if (!e.pulito) assert.equal(e.motivo, 'bestemmia');
  });
}

test('le parolacce della lista si bloccano da parole intere', () => {
  assert.equal(parolaccia('sei un coglione'), 'coglione');
  assert.equal(parolaccia('che cazzo di partita'), 'cazzo');
});

test('una parolaccia dentro un altra parola non conta', () => {
  // "scazzottata" contiene "cazzo": cercare dentro le parole punirebbe chi non
  // ha fatto niente, ed e il modo piu rapido di farsi odiare
  assert.equal(parolaccia('è finita in una scazzottata'), null);
});

test('i numeri al posto delle lettere non salvano', () => {
  assert.equal(parolaccia('c4zz0'), 'cazzo');
});

test('normalizza toglie accenti, numeri e lettere ripetute', () => {
  assert.deepEqual(normalizza('Perchééé D1O!!!').parole, ['perche', 'dio']);
  assert.equal(normalizza('a b c').unito, 'abc');
});

test('due qualifiche senza nome divino non sono una bestemmia', () => {
  assert.equal(bestemmia('porco cane'), null);
  assert.equal(bestemmia('che bestia di un maiale'), null);
});

test('una parolina in mezzo e la coppia non scatta', () => {
  // scelta voluta: si perde qualche bestemmia costruita in modo strano, ma non
  // si blocca chi scrive italiano normale
  assert.equal(bestemmia('il cane appartiene a Dio'), null);
});

test('la spiegazione c e sempre quando si blocca, mai quando passa', () => {
  assert.equal(spiegazione(controlla('ciao')), null);
  assert.match(spiegazione(controlla('dio porco')) ?? '', /bestemmie/);
  assert.match(spiegazione(controlla('coglione')) ?? '', /parola/);
});

/* ------------------------------------------------------------ oscuramento */

test('la parolaccia si copre e il resto della frase resta', () => {
  const r = maschera('che coglione l’arbitro');
  assert.equal(r.testo, 'che c******* l’arbitro');
  assert.equal(r.cambiato, true);
});

test('una frase pulita non viene toccata', () => {
  const r = maschera('che gol di Petito al 24esimo');
  assert.equal(r.testo, 'che gol di Petito al 24esimo');
  assert.equal(r.cambiato, false);
});

test('la bestemmia su due parole si copre tutta', () => {
  assert.equal(maschera('dio porco che partita').testo, 'd** p**** che partita');
});

test('la bestemmia attaccata si copre come una parola sola', () => {
  assert.equal(maschera('porcodio').testo, 'p*******');
});

test('scritta spezzata lettera per lettera: si copre tutto', () => {
  // non esiste una parola da coprire, e chi scrive cosi lo fa apposta
  const r = maschera('d i o p o r c o');
  assert.equal(r.cambiato, true);
  assert.ok(controlla(r.testo).pulito);
});

test('la punteggiatura e gli spazi restano dov erano', () => {
  assert.equal(maschera('ma che cazzo, davvero?').testo, 'ma che c****, davvero?');
});

test('coprire due volte non cambia niente', () => {
  const una = maschera('sei uno stronzo').testo;
  assert.equal(maschera(una).testo, una);
});

test('la famiglia ki te mu ort si copre in tutte le sue forme', () => {
  for (const parola of ['kitemu', 'kitemuort', 'kitemmuort', 'kitemuortt', 'kitestramu', 'chitemurt']) {
    const r = maschera(`vai ${parola} va`);
    assert.equal(r.cambiato, true, parola);
    assert.ok(r.testo.includes('*'), parola);
  }
});

test('le parole italiane che somigliano al dialetto passano', () => {
  // "recitemmo" contiene "citemmo": la regola parte dall'inizio della parola
  for (const frase of ['recitemmo la formazione', 'la chitarra di mio fratello', 'citeremo le fonti']) {
    assert.equal(maschera(frase).cambiato, false, frase);
  }
});

test('le aggiunte nostre sono nell elenco', () => {
  for (const parola of ['bastarda', 'zoccola', 'puttana', 'cornuto', 'strunzo']) {
    assert.equal(maschera(parola).cambiato, true, parola);
  }
});

test('oscura tiene la prima lettera', () => {
  assert.equal(oscura('merda'), 'm****');
  assert.equal(oscura('a'), '*');
  assert.equal(oscura(''), '*');
});
