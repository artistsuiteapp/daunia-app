/**
 * Una partita intera, giocata in pochi secondi: la prova di quando ogni cosa
 * arriva nell'app. Il perche e la partita finta stanno in `simulazione.ts`.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { gioca, visibile, secondi, SCENARI, REALTA, K, MIN } from './simulazione.ts';

/** Il ritardo massimo accettato fra la fonte e la riga che l'app legge. */
const TETTO = 30_000;

for (const [nome, s] of SCENARI) {
  test(`${nome}: cartellini, cambi e rosso arrivano entro trenta secondi dalla fonte`, async () => {
    const { primaVolta } = await gioca(s);
    const [giallo, , cambio, , rosso] = REALTA.eventi;

    const tGiallo = primaVolta((f) => f.cartellini.some((c) => c.minuto === 12));
    const tCambio = primaVolta((f) => f.cambi.some((c) => c.minuto === 60));
    const tRosso = primaVolta((f) => f.cartellini.some((c) => c.minuto === 85 && c.rosso));

    assert.ok(tGiallo - visibile(giallo.quando, s, true) <= TETTO,
      `giallo in ritardo di ${secondi(tGiallo - visibile(giallo.quando, s, true))} s`);
    assert.ok(tCambio - visibile(cambio.quando, s, true) <= TETTO,
      `cambio in ritardo di ${secondi(tCambio - visibile(cambio.quando, s, true))} s`);
    assert.ok(tRosso - visibile(rosso.quando, s, true) <= TETTO,
      `rosso in ritardo di ${secondi(tRosso - visibile(rosso.quando, s, true))} s`);
  });

  test(`${nome}: ogni gol compare sul tabellone entro trenta secondi dalla prima fonte`, async () => {
    const { primaVolta } = await gioca(s);
    const [, primo, , secondo] = REALTA.eventi;

    const tPrimo = primaVolta((f) => f.casa === 1);
    const tSecondo = primaVolta((f) => f.casa === 1 && f.ospiti === 1);

    assert.ok(tPrimo - visibile(primo.quando, s) <= TETTO,
      `1-0 in ritardo di ${secondi(tPrimo - visibile(primo.quando, s))} s`);
    assert.ok(tSecondo - visibile(secondo.quando, s) <= TETTO,
      `1-1 in ritardo di ${secondi(tSecondo - visibile(secondo.quando, s))} s`);
  });

  test(`${nome}: il nome del marcatore arriva entro trenta secondi dalla fonte`, async () => {
    const { primaVolta } = await gioca(s);
    const primo = REALTA.eventi[1];
    const tNome = primaVolta((f) => f.gol.some((g) => g.chi === 'A. Rossi'));
    const pubblicato = K + primo.quando + primo.nomeDopo! + s.ritardoLsa;
    assert.ok(tNome - pubblicato <= TETTO, `nome in ritardo di ${secondi(tNome - pubblicato)} s`);
  });

  test(`${nome}: la partita non finisce prima del triplice fischio, e si chiude una volta sola col risultato giusto`, async () => {
    const { foto } = await gioca(s);
    const primaDellaFine = foto.filter((f) => f.t < K + REALTA.fine);
    assert.ok(primaDellaFine.every((f) => f.stato !== 'FT' && !f.finita_il),
      `finita in anticipo al minuto ${Math.round(((primaDellaFine.find((f) => f.stato === 'FT' || f.finita_il)?.t ?? 0) - K) / MIN)} dal fischio`);

    const chiusa = foto.find((f) => f.finita_il);
    assert.ok(chiusa, 'la partita non si e mai chiusa');
    assert.deepEqual({ casa: chiusa.casa, ospiti: chiusa.ospiti }, { casa: 1, ospiti: 1 },
      'la partita si e chiusa con il risultato sbagliato: i punti dei pronostici sarebbero sbagliati per sempre');
    assert.ok(chiusa.t - (K + REALTA.fine) <= 15 * MIN,
      `chiusa ${Math.round((chiusa.t - K - REALTA.fine) / MIN)} minuti dopo il fischio`);
  });

  test(`${nome}: ogni gol fa suonare una notifica sola, e il rosso pure`, async () => {
    const { suonate } = await gioca(s);
    const gol = suonate.filter((x) => x.tipo === 'gol' && !x.muta);
    const rossi = suonate.filter((x) => x.tipo === 'espulsione' && !x.muta);
    assert.equal(gol.length, 2, `notifiche di gol: ${gol.map((g) => g.titolo).join(' | ')}`);
    assert.equal(rossi.length, 1, `notifiche di espulsione: ${rossi.length}`);
  });
}

test('nel secondo tempo il minuto non torna al recupero del primo, e non va mai indietro', async () => {
  for (const [nome, s] of SCENARI) {
    const { foto } = await gioca(s);
    const valore = (m: string) => { const x = /^(\d+)(?:\+(\d+))?$/.exec(m); return x ? Number(x[1]) + Number(x[2] ?? 0) : NaN; };
    let prima = -1;
    let tempo = '';
    for (const f of foto) {
      if (f.stato === '2H' && f.minuto) assert.ok(Number(f.minuto.split('+')[0]) > 45, `${nome}: "${f.minuto}" nel secondo tempo`);
      // il conto riparte a ogni tempo: "46" viene dopo "45+2"
      if (f.stato !== tempo) { tempo = f.stato; prima = -1; }
      if (!f.minuto) continue;
      assert.ok(valore(f.minuto) >= prima, `${nome}: il minuto e tornato indietro a ${f.minuto}`);
      prima = valore(f.minuto);
    }
  }
});

test('una partita costa a live-score-api meno di seicento chiamate', async () => {
  const { chiamate } = await gioca(SCENARI[0][1]);
  const lsa = Object.entries(chiamate).filter(([u]) => u.startsWith('livescore-api.com')).reduce((n, [, c]) => n + c, 0);
  assert.ok(lsa <= 600, `${lsa} chiamate: la prova ne concede 1.500 al giorno, e l'ingest ne usa altre`);
});

test('senza live-score-api il tabellone di TheSportsDB basta, e la partita si chiude giusta', async () => {
  const s = { ritardoTsdb: 30_000, ritardoLsa: 0, legaApre: 0.5 * MIN, senzaLsa: true };
  const { foto, primaVolta } = await gioca(s);
  const [, primo, , secondo] = REALTA.eventi;
  assert.ok(primaVolta((f) => f.casa === 1) - (K + primo.quando + s.ritardoTsdb) <= TETTO);
  assert.ok(primaVolta((f) => f.ospiti === 1) - (K + secondo.quando + s.ritardoTsdb) <= TETTO);
  assert.ok(foto.filter((f) => f.t < K + REALTA.fine).every((f) => f.stato !== 'FT' && !f.finita_il));
  const chiusa = foto.find((f) => f.finita_il);
  assert.ok(chiusa && chiusa.casa === 1 && chiusa.ospiti === 1, 'chiusa col risultato sbagliato');
  assert.ok(chiusa.t - (K + REALTA.fine) <= 15 * MIN);
});

test('live-score-api guasto per un quarto d ora: appena torna, cartellini e gol arrivano', async () => {
  const s = { ritardoTsdb: 150_000, ritardoLsa: 40_000, legaApre: 0.5 * MIN, lsaGuastaFinoA: 15 * MIN };
  const { primaVolta } = await gioca(s);
  const tGiallo = primaVolta((f) => f.cartellini.some((c) => c.minuto === 12));
  assert.ok(tGiallo - (K + s.lsaGuastaFinoA) <= 3 * MIN + TETTO,
    `il giallo e arrivato ${secondi(tGiallo - K - s.lsaGuastaFinoA)} s dopo che la fonte e tornata`);
  const tRosso = primaVolta((f) => f.cartellini.some((c) => c.minuto === 85 && c.rosso));
  assert.ok(tRosso - visibile(REALTA.eventi[4].quando, s, true) <= TETTO, 'dopo il guasto si torna a leggere a ogni giro');
});

test('calcio d inizio in ritardo di un quarto d ora: il dal vivo parte lo stesso, e la partita non si chiude prima', async () => {
  const s = { ritardoTsdb: 150_000, ritardoLsa: 40_000, legaApre: 0.5 * MIN, ritardoInizio: 15 * MIN };
  const { foto, primaVolta } = await gioca(s);
  const inizio = primaVolta((f) => f.stato === '1H');
  assert.ok(inizio - (K + s.ritardoInizio + s.ritardoLsa) <= TETTO, `inizio visto ${secondi(inizio - K - s.ritardoInizio - s.ritardoLsa)} s dopo la fonte`);
  const tGiallo = primaVolta((f) => f.cartellini.some((c) => c.minuto === 12));
  assert.ok(tGiallo - visibile(REALTA.eventi[0].quando, s, true) <= TETTO, `giallo in ritardo di ${secondi(tGiallo - visibile(REALTA.eventi[0].quando, s, true))} s`);
  const fine = K + s.ritardoInizio + REALTA.fine;
  assert.ok(foto.filter((f) => f.t < fine).every((f) => f.stato !== 'FT' && !f.finita_il), 'chiusa prima del fischio');
  const chiusa = foto.find((f) => f.finita_il);
  assert.ok(chiusa && chiusa.casa === 1 && chiusa.ospiti === 1);
});

test('i giri di un minuto non entrano mai nel minuto dopo', async () => {
  const { sovrapposizioni } = await gioca(SCENARI[0][1]);
  assert.equal(sovrapposizioni, 0);
});

test('le formazioni compaiono entro tre minuti da quando la Lega apre la partita', async () => {
  const s = SCENARI[0][1];
  const { primaVolta } = await gioca(s);
  const t = primaVolta((f) => Boolean(f.formazione));
  assert.ok(t - (K + s.legaApre) <= 3 * MIN, `formazioni in ritardo di ${secondi(t - K - s.legaApre)} s`);
});
