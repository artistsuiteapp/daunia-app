# Da dove arrivano i dati delle partite

Verificato il 5 settembre 2026 chiamando le API a mano, non leggendo le pagine
di marketing. Le pagine di marketing dicono altro.

## Il punto di partenza sbagliato

API-Football sul piano gratuito risponde così a una richiesta sulla stagione in
corso:

```
"Free plans do not have access to this season, try from 2022 to 2024."
```

Da lì sembrava che per le formazioni della Serie C servissero 19 dollari al
mese. Non è così.

## Il limite è sui parametri, non sui dati

Il piano gratuito rifiuta tre parametri: `season`, `last`, `next`. Le chiamate
che non li usano rispondono con la stagione in corso, gratis.

| Chiamata | Piano gratuito | Cosa dà |
|---|---|---|
| `fixtures?season=2026&league=943` | ❌ rifiutata | — |
| `fixtures?team=521&last=3` | ❌ rifiutata | — |
| `fixtures?date=2026-09-06` | ✅ | tutte le partite del giorno, si filtra a valle |
| `fixtures?id=1609005` | ✅ | una partita, stato e punteggio dal vivo |
| `fixtures/lineups?fixture=N` | ✅ | undici titolari con numero, panchina |
| `fixtures/events?fixture=N` | ✅ | gol, assist, cartellini, cambi, col minuto |
| `players/squads?team=521` | ✅ | la rosa di oggi, 23 uomini con foto |
| `standings?league=943&season=2026` | ❌ rifiutata | (la classifica resta Wikipedia) |

`fixtures?date=` ha un limite suo: copre solo ieri, oggi e domani. Fuori da lì
risponde `"Free plans do not have access to this date"`. Per le partite più
vecchie serve l'id, e `fixtures?id=` quel limite non ce l'ha.

## Il ponte per le partite vecchie

Gli id delle partite arrivano da **TheSportsDB**, chiave pubblica `123`, senza
limiti di data. Ogni evento porta il campo `idAPIfootball`:

```
eventsround.php?id=4398&r=2&s=2026-2027
  → Foggia vs Salernitana, 2026-08-29, idAPIfootball = 1609005
```

Con quell'id si scaricano formazioni ed eventi di qualsiasi giornata.

TheSportsDB ha anche calendario, orari, punteggi e classifica della stagione in
corso, gratis. Le formazioni no: per la Serie C il campo `lineup` torna vuoto
mentre per la Serie B è pieno, quindi è un buco di copertura, non un paywall.

## Cosa non esiste, a nessun prezzo

Il campo `coverage` della lega 943 dice:

```
season 2026 | current true | lineups true | statistics_fixtures false | events true
```

`statistics_fixtures: false` significa che possesso palla, tiri, falli e pagelle
per la Serie C non ci sono nemmeno pagando. `fixtures/statistics` risponde con
zero risultati. Anche `formation` e `coach` tornano vuoti: il modulo non lo
pubblica nessuno, quindi la disposizione in campo la decidiamo noi dai ruoli.

## Quanto costa in quota

Cento chiamate al giorno, e il cron gira ogni mezz'ora: 48 giri. Le regole che
tengono i conti in ordine stanno in `services/ingest/src/sources/apifootball.mjs`
e in `run.mjs`:

- **fuori dalla finestra di una partita, zero chiamate.** La finestra è da due
  ore prima del calcio d'inizio a sei ore dopo.
- **partita già completa (finita, con formazioni ed eventi salvati), zero chiamate.**
- **arretrati: due partite per giro al massimo,** tre chiamate ciascuna.
- **rosa: una chiamata a settimana.**

Giornata senza partite: 0 o 1 chiamata. Giornata di partita: una quarantina.

## Riepilogo delle fonti

| Dato | Fonte | Costo |
|---|---|---|
| Calendario, classifica, rosa | Wikipedia | 0 |
| Stemmi, foto, comunicati | sito del club (WordPress REST) | 0 |
| Id delle partite, orari, punteggi | TheSportsDB (chiave `123`) | 0 |
| Formazioni, eventi, punteggio dal vivo | API-Football (piano gratuito) | 0 |
| Rosa aggiornata | API-Football (piano gratuito) | 0 |
| Statistiche di fine partita | **non esistono per la Serie C** | — |
