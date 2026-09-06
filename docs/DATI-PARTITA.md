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

## Il punteggio ha tre fonti, non una

Il guardiano incrocia il tabellone di TheSportsDB con i gol contati dagli eventi
di API-Football. Il conteggio non costa niente: è la stessa risposta che serve
per sapere chi ha segnato.

Quando le due non concordano, il numero non si stampa: la notifica dice
"GOL DEL FOGGIA!" con minuto e marcatore, e il punteggio si tace finché non è
confermato. Prima prendeva il gol da una fonte e il numero dall'altra, e nel
momento del disallineamento annunciava "GOL DEL FOGGIA! 0-0".

La terza fonte è `fixtures?id=`, che dà `goals` direttamente. Si paga una
chiamata, quindi parte solo quando le prime due litigano *e* c'è un gol da
annunciare in quel momento, con un tetto di sei volte a partita: una gara senza
copertura litigherebbe per novanta minuti di fila.

Il tabellone da solo può far partire una notifica. Serve perché per la Serie C
gli eventi di API-Football hanno buchi: senza, una partita senza eventi non
avrebbe fatto suonare niente. In quel caso il testo dice che il marcatore non
risulta ancora, e i due minuti di attesa evitano che lo stesso gol arrivi due
volte, una per fonte.

## Riepilogo delle fonti

| Dato | Fonte | Costo |
|---|---|---|
| Calendario, classifica, rosa | Wikipedia | 0 |
| Stemmi, foto, comunicati | sito del club (WordPress REST) | 0 |
| Id delle partite, orari, punteggi | TheSportsDB (chiave `123`) | 0 |
| Formazioni, eventi, punteggio dal vivo | API-Football (piano gratuito) | 0 |
| Rosa aggiornata | API-Football (piano gratuito) | 0 |
| Statistiche di fine partita | **non esistono per la Serie C** | — |

## Il freno che impedisce una seconda sospensione

Il primo account e stato sospeso automaticamente il 6 settembre 2026, a meta
partita. I termini di API-Football dicono che richieste "sproporzionate o
eccessive" fanno scattare il firewall, e il conto tornava: il guardiano da solo
arrivava a sessantacinque chiamate in un pomeriggio, piu una quarantina
dell'ingest, contro un tetto di cento al giorno e dieci al minuto.

Allungare le pause non bastava. Una pausa e una stima di quante chiamate
verranno, e una stima sbagliata costa l'account. Adesso c'e un numero vero:

| Chi | Budget | Dove sta il conto |
|---|---|---|
| Guardiano | 45 al giorno | tabella `quota_af`, funzione `chiedi_quota()` |
| Ingest | 12 per giro | contatore in memoria, `TETTO_PER_GIRO` |
| | | 15 di margine sui 100 |

Il conto del guardiano sta in Postgres e non in memoria perche la funzione
muore a ogni giro: un contatore locale ripartirebbe da zero ogni minuto, che e
esattamente il modo in cui si finisce sospesi senza accorgersene.
`chiedi_quota()` incrementa e decide nella stessa transazione, quindi due giri
simultanei non possono passare tutti e due l'ultimo posto. **Se il database non
risponde, la risposta e no**: perdere il nome di un marcatore costa meno che
perdere l'account.

L'ingest ha anche una pausa di sette secondi fra una chiamata e l'altra, che
tiene il ritmo a otto al minuto contro un limite di dieci. Il guardiano non ne
ha bisogno: fa al massimo tre chiamate per giro e i giri sono uno al minuto.

## Se API-Football si blocca

Lo stesso servizio ha due porte, con account e chiavi separate:

| Porta | Host | Intestazione |
|---|---|---|
| Diretta | `v3.football.api-sports.io` | `x-apisports-key` |
| RapidAPI | `api-football-v1.p.rapidapi.com/v3` | `x-rapidapi-key` + `x-rapidapi-host` |

Piano gratuito da entrambe le parti: cento chiamate al giorno, risposte
identiche. Se un account resta bloccato, se ne apre uno dall'altra porta e si
cambia una variabile, non una riga di codice:

```bash
npx supabase secrets set API_FOOTBALL_KEY=<chiave> API_FOOTBALL_VIA=rapidapi
```

Senza `API_FOOTBALL_VIA` si usa la porta diretta. Lo stesso vale per l'ingest,
che legge le stesse due variabili d'ambiente.

## Cosa funziona senza API-Football

| Dato | Fonte | Serve API-Football? |
|---|---|---|
| Punteggio dal vivo | `livescore.php` | no |
| Minuto di gioco, recupero compreso | `livescore.php` (`strProgress`) | no |
| Inizio, intervallo, fine | `livescore.php` | no |
| Notifiche dei gol | tabellone | no |
| Cronaca con minuto e punteggio | tabellone | no |
| **Nome di chi ha segnato** | eventi | **sì** |
| **Formazioni ufficiali** | lineups | **sì** |

Le ultime due non hanno alternativa gratuita per la Serie C: TheSportsDB tiene
`lookuptimeline` e `lookuplineup` dietro il piano a pagamento (tornano `null`
con la chiave pubblica anche per la Serie A, quindi e un limite della chiave,
non un buco di copertura), e le v2 rispondono "Invalid Premium API key".
