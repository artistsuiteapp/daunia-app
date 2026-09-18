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

test('TheSportsDB torna a 0-0 per sbaglio mentre live-score-api e giu: il gol non si cancella e non suona due volte', async () => {
  const s = {
    ritardoTsdb: 150_000, ritardoLsa: 40_000, legaApre: 0.5 * MIN,
    lsaGuastaDa: 29 * MIN, lsaGuastaFinoA: 33 * MIN, tsdbAZero: { da: 30 * MIN, a: 31 * MIN },
  };
  const { foto, suonate } = await gioca(s);
  const dopoIlGol = foto.filter((f) => f.t > K + 24 * MIN && f.t < K + 90 * MIN);
  assert.ok(dopoIlGol.every((f) => f.casa === 1), 'il punteggio e tornato a 0-0 per una lettura sbagliata');
  const gol = suonate.filter((x) => x.tipo === 'gol' && !x.muta);
  assert.equal(gol.length, 2, `notifiche di gol: ${gol.map((g) => g.titolo).join(' | ')}`);
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

/* ------------------------------------------- le formazioni e il recupero dal web */

test('le formazioni arrivano prima del fischio, dalla diretta della testata', async () => {
  const s = SCENARI[0][1];
  const { primaVolta } = await gioca(s);
  const t = primaVolta((f) => Boolean(f.formazione));
  // la testata le pubblica un'ora prima; la Lega apre solo al calcio d'inizio
  assert.ok(t < K, `formazioni comparse ${secondi(t - K)} s dopo il fischio`);
  assert.ok(t - (K - 60 * MIN) <= 4 * MIN, `formazioni in ritardo di ${secondi(t - K + 60 * MIN)} s`);
});

test('senza la diretta della testata si aspetta la Lega, come prima', async () => {
  const s = { ...SCENARI[0][1], senzaDiretta: true };
  const { primaVolta } = await gioca(s);
  const t = primaVolta((f) => Boolean(f.formazione));
  assert.ok(t >= K, 'formazioni comparse prima del fischio senza averle da nessuno');
  assert.ok(t - (K + s.legaApre) <= 3 * MIN, `formazioni in ritardo di ${secondi(t - K - s.legaApre)} s`);
});

test('i minuti di recupero compaiono sul tabellone, e spariscono a tempo finito', async () => {
  const { foto } = await gioca(SCENARI[0][1]);
  const primo = foto.find((f) => f.recupero === 2);
  assert.ok(primo, 'il recupero del primo tempo non e mai comparso');
  assert.ok(primo.t < K + REALTA.intervallo, 'il recupero e arrivato dopo l intervallo');

  // all'intervallo il cartello non c'e piu
  const allIntervallo = foto.filter((f) => f.stato === 'HT');
  assert.ok(allIntervallo.length && allIntervallo.at(-1)!.recupero === null,
    'il recupero del primo tempo e rimasto scritto all intervallo');

  const ripresa = foto.find((f) => f.recupero === 5);
  assert.ok(ripresa, 'il recupero della ripresa non e mai comparso');
  assert.equal(foto.at(-1)!.recupero, null, 'il recupero e rimasto scritto a partita finita');
});

/* ------------------------------------------------------- il tabellone a mano */

/** Come scrive la funzione del database quando si preme "gol" nel pannello. */
const golAMano = (lato: 'casa' | 'ospiti', chi: string | null, minuto: number) =>
  (riga: Record<string, unknown>) => {
    const casa = (riga.casa as number ?? 0) + (lato === 'casa' ? 1 : 0);
    const ospiti = (riga.ospiti as number ?? 0) + (lato === 'ospiti' ? 1 : 0);
    return {
      manuale: true,
      casa,
      ospiti,
      gol: [...(riga.gol as unknown[] ?? []), {
        id: `m${minuto}`, minuto: String(minuto), chi, nostro: lato === 'casa', lato, fonte: 'admin', casa, ospiti,
      }],
    };
  };

test('segno io il gol prima delle fonti, e il tabellone non lo perde', async () => {
  const s = {
    ...SCENARI[0][1],
    // il gol vero lo vede in campo l'amministratore al 6', le fonti solo al 23'
    pannello: [{ quando: 6 * MIN, fa: golAMano('casa', 'Luciani', 6) }],
  };
  const { foto, suonate } = await gioca(s);

  const dopo = foto.filter((f) => f.t > K + 6 * MIN && f.t < K + REALTA.fine);
  assert.ok(dopo.every((f) => (f.casa ?? 0) >= 1), 'il punteggio a mano e stato cancellato dalle fonti');
  // il gol vero delle fonti al 23' non deve aggiungersi a quello gia segnato
  assert.ok(dopo.every((f) => (f.casa ?? 0) === 1), 'il gol e stato contato due volte');

  const gol = suonate.filter((x) => x.tipo === 'gol' && !x.muta);
  assert.ok(gol[0].titolo.includes('GOL DEL FOGGIA! 1-0'), gol[0].titolo);
  assert.ok(gol[0].testo.includes('Luciani'), gol[0].testo);
  // e arriva subito, non quando lo vedono le fonti
  assert.ok(gol[0].t - (K + 6 * MIN) <= 60_000, `notifica in ritardo di ${secondi(gol[0].t - K - 6 * MIN)} s`);

  // quello che vedono le fonti resta scritto, per chi sta segnando
  const tardi = foto.filter((f) => f.t > K + 100 * MIN);
  assert.ok(tardi.some((f) => f.fonti.casa === 1 && f.fonti.ospiti === 1),
    'il punteggio delle fonti non si vede piu da nessuna parte');
});

test('segno il gol e poi mi addormento: appena le fonti mi raggiungono riprendono loro', async () => {
  const s = {
    ...SCENARI[0][1],
    // un solo tocco al pannello, al 6'. Poi piu niente: nessuno spegne niente
    pannello: [{ quando: 6 * MIN, fa: golAMano('casa', 'Luciani', 6) }],
  };
  const { foto, suonate, primaVolta } = await gioca(s);

  // le fonti vedono lo stesso gol verso il 23': da li il tabellone torna loro
  const tornato = foto.find((f) => f.t > K + 20 * MIN && !f.aMano);
  assert.ok(tornato, 'il tabellone e rimasto a mano per tutta la partita');
  assert.ok(tornato.t < K + 30 * MIN, `ripreso solo al ${secondi(tornato.t - K) / 60} minuto`);

  // e il gol degli avversari al 78' entra da solo, senza che nessuno tocchi niente
  const pari = primaVolta((f) => f.casa === 1 && f.ospiti === 1);
  assert.ok(Number.isFinite(pari), 'il gol degli avversari non e mai arrivato sul tabellone');
  const [, , , secondo] = REALTA.eventi;
  assert.ok(pari - visibile(secondo.quando, s) <= TETTO,
    `1-1 in ritardo di ${secondi(pari - visibile(secondo.quando, s))} s`);

  // e suona, come tutti i gol che nessuno ha annunciato
  assert.ok(suonate.some((x) => x.tipo === 'gol' && !x.muta && /Gol subito/.test(x.titolo)),
    `notifiche: ${suonate.filter((x) => x.tipo === 'gol').map((x) => x.titolo).join(' | ')}`);

  // e la partita si chiude col risultato vero, non con quello fermo al 6'
  const chiusa = foto.find((f) => f.finita_il);
  assert.deepEqual([chiusa?.casa, chiusa?.ospiti], [1, 1]);
});

for (const [nome, base] of SCENARI) {
  test(`${nome}: un gol segnato a mano suona una volta sola, anche quando le fonti lo raggiungono`, async () => {
    const { suonate } = await gioca({
      ...base,
      pannello: [{ quando: 6 * MIN, fa: golAMano('casa', 'Luciani', 6) }],
    });
    // il 6' del pannello e il 78' degli avversari: il 23' delle fonti e lo stesso gol del 6'
    const gol = suonate.filter((x) => x.tipo === 'gol' && !x.muta);
    assert.equal(gol.length, 2, `notifiche di gol: ${gol.map((g) => `${g.titolo} ${g.testo}`).join(' | ')}`);
  });
}

test('un gol annullato e gia ripreso dalle fonti non blocca il tabellone riacceso dopo', async () => {
  const s = {
    ...SCENARI[0][1],
    pannello: [
      // al 6' un gol degli avversari premuto per sbaglio, tolto al 9': le fonti riprendono
      { quando: 6 * MIN, fa: golAMano('ospiti', null, 6) },
      {
        quando: 9 * MIN,
        fa: () => ({
          ospiti: 0,
          gol: [],
          annullati: [{ id: 'm6', minuto: '6', chi: null, nostro: false, lato: 'ospiti' }],
        }),
      },
      // al 60' un gol a mano che le fonti non vedranno: il tabellone resta a mano
      { quando: 60 * MIN, fa: golAMano('casa', 'Petito', 60) },
    ],
  };
  const { foto } = await gioca(s);
  const chiusa = foto.find((f) => f.finita_il);
  // il gol degli avversari al 78' deve entrare: l'annullamento del 9' e chiuso da un pezzo
  assert.deepEqual([chiusa?.casa, chiusa?.ospiti], [2, 1]);
});

test('un gol annullato non torna, ma il lato degli avversari continua ad aggiornarsi', async () => {
  const s = {
    ...SCENARI[0][1],
    pannello: [{
      // al 30' l'arbitro annulla il gol del 23': le fonti pero continuano a contarlo
      quando: 30 * MIN,
      fa: (riga: Record<string, unknown>) => ({
        manuale: true,
        manuale_base: { casa: 0, ospiti: 0 },
        casa: 0,
        gol: [],
        annullati: [{ id: 'x23', minuto: '23', chi: 'A. Rossi', nostro: true, lato: 'casa' }],
      }),
    }],
  };
  const { foto, primaVolta } = await gioca(s);

  const dopo = foto.filter((f) => f.t > K + 31 * MIN && f.t < K + REALTA.fine);
  assert.ok(dopo.every((f) => (f.casa ?? 0) === 0), 'il gol annullato e tornato sul tabellone');
  // le fonti intanto continuano a dire 1: e giusto che si veda
  assert.ok(dopo.some((f) => f.fonti.casa === 1), 'il punteggio delle fonti non si vede');

  // il gol degli avversari al 78' entra lo stesso: quel lato non c'entra con l'annullamento
  const loro = primaVolta((f) => f.ospiti === 1);
  assert.ok(Number.isFinite(loro), 'il gol degli avversari non e arrivato');
  assert.ok(foto.find((f) => f.t >= loro)?.casa === 0, 'insieme al loro gol e tornato anche quello annullato');
});

test('un gol annullato lo dice, e il punteggio torna indietro', async () => {
  const s = {
    ...SCENARI[0][1],
    pannello: [
      { quando: 6 * MIN, fa: golAMano('casa', 'Luciani', 6) },
      {
        quando: 9 * MIN,
        fa: (riga: Record<string, unknown>) => ({
          casa: 0,
          gol: [],
          annullati: [{ id: 'm6', minuto: '6', chi: 'Luciani', nostro: true, lato: 'casa' }],
        }),
      },
    ],
  };
  const { foto, suonate } = await gioca(s);

  const dopo = foto.filter((f) => f.t > K + 10 * MIN && f.t < K + 20 * MIN);
  assert.ok(dopo.every((f) => (f.casa ?? 0) === 0), 'il gol annullato e tornato sul tabellone');

  const annullo = suonate.find((x) => x.titolo.startsWith('Gol annullato'));
  assert.ok(annullo, `notifiche: ${suonate.map((x) => x.titolo).join(' | ')}`);
  assert.ok(annullo.testo.includes('Luciani'), annullo.testo);
  assert.ok(annullo.t - (K + 9 * MIN) <= 60_000, `annullamento in ritardo di ${secondi(annullo.t - K - 9 * MIN)} s`);
});

test('a mano si chiude col punteggio dell amministratore, non con quello delle fonti', async () => {
  const s = {
    ...SCENARI[0][1],
    pannello: [
      { quando: 6 * MIN, fa: golAMano('casa', 'Luciani', 6) },
      // col tabellone a mano si segna tutto, anche il gol degli altri
      { quando: 95 * MIN, fa: golAMano('ospiti', null, 78) },
      { quando: 100 * MIN, fa: golAMano('casa', 'Petito', 82) },
    ],
  };
  const { foto } = await gioca(s);
  const chiusa = foto.find((f) => f.finita_il);
  assert.ok(chiusa, 'la partita non si e mai chiusa');
  // le fonti si fermano a 1-1: il risultato pagato ai pronostici e quello visto dal campo
  assert.deepEqual([chiusa.casa, chiusa.ospiti], [2, 1]);
  assert.deepEqual([chiusa.fonti.casa, chiusa.fonti.ospiti], [1, 1]);
});
