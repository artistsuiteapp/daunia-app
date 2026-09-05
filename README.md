# Satanelli — app tifosi del Calcio Foggia 1920

Prototipo per una proposta al club. Non è pensato per essere pubblicato sugli store così com'è: usa stemma, colori e nome della società, e quelli richiedono una licenza scritta.

## Cosa fa

Calendario e risultati della stagione in corso, classifica del girone C, rosa, schede giocatore, notizie ufficiali, blog redazionale e una mappa 3D dello Zaccheria che mostra i settori con prezzo e link alla biglietteria.

## Da dove arrivano i dati

Nessuna API a pagamento. Due fonti pubbliche, unite in un solo contratto dati.

| Cosa | Fonte | Nota |
|---|---|---|
| Calendario, risultati, marcatori | Wikipedia (`Calcio Foggia 1920 2026-2027`) | Include minuto del gol, arbitro, spettatori |
| Classifica girone C | Wikipedia (`Serie C 2026-2027`) | 20 squadre, penalizzazioni comprese |
| Rosa, allenatore, presidente | Wikipedia | Aggiornata dai volontari, di solito entro il giorno |
| Notizie ufficiali | `calciofoggia1920.net` REST API | L'unica cosa fresca sul sito del club |
| Stemmi e foto giocatori | `calciofoggia1920.net` (SportsPress) | Fototeca ferma alla stagione 2025-2026 |
| Post redazionali | `data/blog/*.md` | Un file per articolo, frontmatter minimo |
| Statistiche di squadra e andamento | Wikipedia | Casa/trasferta per competizione, posizione giornata per giornata |
| Prodotti, prezzi, foto | `calciofoggia1920.store` (WooCommerce Store API) | Catalogo vero del negozio ufficiale |

Il sito del club espone SportsPress via REST e `robots.txt` non pone restrizioni, ma i contenuti sportivi sono fermi a un anno fa: zero partite dopo agosto 2026, nessun risultato mai compilato, rosa non aggiornata. Per questo la stagione in corso viene da Wikipedia. È anche il primo argomento del pitch.

## Come gira l'aggiornamento

Un workflow GitHub Actions (`.github/workflows/ingest.yml`) esegue l'ingest ogni 15 minuti e committa i JSON in `data/`. L'app legge quei file, non le fonti. Costo zero, il sito del club riceve quattro richieste all'ora invece di una per ogni telefono, e l'app apre senza attese.

L'ingest non ha dipendenze npm: gira con Node 20 senza `npm install`.

## Struttura

```
apps/mobile/           Expo (React Native) + expo-router
  app/(tabs)/          home · partite · rosa · stadio · store · news
  app/stats.tsx        statistiche di squadra
  app/tickets.tsx      biglietti con tagliando di esempio
  app/product/[id]     scheda prodotto
  features/stadium3d/  geometria parametrica three.js
  theme/               brand.ts (identità) + tokens.ts (design system)
  lib/data.ts          accesso ai dati e selettori
services/ingest/       scaricamento e normalizzazione
  src/sources/         foggia-wp · wikipedia · blog
packages/core/         contratto dati TypeScript condiviso
data/                  JSON prodotti dall'ingest, letti dall'app
assets/                foto dello stadio e reference di design
```

Il contratto in `packages/core` è la parte che protegge il lavoro: quando il club fornisce un feed ufficiale si riscrive solo `services/ingest/src/sources/`, l'app non cambia una riga.

## Dove sta il progetto

Il codice vive su `~/dev/satanelli-app` (disco interno, APFS). Le foto originali dello stadio e le reference di design restano anche su `/Volumes/SP2025/APP FOGGIA CALCIO/`, ma le copie che servono al progetto sono dentro `assets/`.

Il volume esterno è formattato exFAT, che ha cluster grandi: `node_modules` occupava sei gigabyte apparenti contro il circa un gigabyte e mezzo reale, e l'installazione richiedeva venti minuti invece di uno. Per questo il progetto sta sul disco interno.

## Comandi

```bash
npm run ingest          # scarica e scrive data/*.json
npm run ingest:dry      # stampa il riassunto senza scrivere
npm run mobile          # avvia l'app
```

`NO_CACHE=1` davanti all'ingest salta la cache su disco.

## Stadio 3D

Lo Zaccheria è generato da parametri, non importato da un modello 3D. Ogni tribuna nasce da lunghezza, profondità, numero di file e altezze; il profilo a gradoni si estrude lungo lo sviluppo della gradinata. Conseguenze pratiche: il bundle resta leggero, ogni settore è già una mesh separata quindi il tap si risolve con un raycast, e cambiare colore in base al riempimento è solo un cambio di materiale.

Sopra la struttura in cemento sta una griglia di seggiolini, una cella per blocco di posti, colorata in vertex color: da lì arrivano le fasce rosse, nere e bianche e il mosaico **FOGGIA** sulla Curva Nord, ricavato da un bitmap 5×7 in `features/stadium3d/font5x7.ts`. Niente texture, perché in React Native non c'è un canvas su cui disegnarle.

Completano la scena il prato con le righe di taglio e la segnaletica regolamentare, le porte, il nastro pubblicitario a bordo campo, il tetto della Tribuna Centrale con le due torri bianche e quattro pali d'angolo con la testa di proiettori.

La scritta sta sulla **gradinata lunga di fronte alla Tribuna Centrale**, come nelle foto, e la camera parte da sopra la Tribuna: è l'unico punto di vista da cui si legge nel verso giusto.

Due viste: **Realistica** mostra lo stadio vuoto con i colori dei seggiolini, **Riempimento** riempie le file dal basso con il pubblico e lascia scoperte quelle invendute. Il riempimento resta una stima finché il club non apre i dati Vivaticket.

## Store, biglietti, statistiche

**Store** legge il catalogo vero da `calciofoggia1920.store`: maglie da gara, tute, polo, zaino, con foto, prezzi e disponibilità. L'app porta al prodotto, il carrello resta sul negozio.

**Biglietti** mostra un tagliando di esempio disegnato come un titolo d'ingresso (strappo, codice a barre, settore, fila, posto) e l'elenco dei settori con intero, ridotto e quota venduta. È un esempio dichiarato: la vendita resta su Vivaticket.

**Statistiche** unisce due cose. Da Wikipedia arrivano il bilancio casa/trasferta per competizione e la posizione giornata per giornata. Dal calendario già in archivio si calcolano medie, porte inviolate, partite senza segnare, fasce di minuti in cui si segna e si subisce, marcatori e spettatori medi.

Geometria ricavata dalle due foto aeree in `assets/stadium/`. Capienza 14.530, il valore dichiarato per la stagione in corso (i 25.085 che circolano sono la capienza storica).

Le capienze per settore, i prezzi e il riempimento sono stime dichiarate come tali sia nei dati sia nell'interfaccia. Diventano reali solo con l'accesso alla biglietteria del club.

## Design

Mobile first, in senso stretto: il telefono non e un caso fra gli altri, e l'unico per cui l'interfaccia e disegnata.

Su browser da desktop l'app viene mostrata dentro una cornice di telefono centrata (`components/AppShell.tsx`), larga 414 punti. A tutta finestra le parti a pieno schermo (la foto dell'intestazione, la barra delle schede, i caroselli) si allargavano mentre il contenuto restava incolonnato al centro, e il risultato sembrava scentrato. Sotto i 760 punti di larghezza la cornice sparisce e l'app torna a tutto schermo.

Le misure della cornice arrivano ai componenti tramite `ViewportContext`: `useLayout()` legge quelle, non quelle della finestra, altrimenti dentro una colonna da 414 punti verrebbe scelto il layout da schermo largo. Su iOS e Android la cornice non esiste e non cambia nulla.

Direzione presa dalle reference in `assets/design-refs/`: fondo nero OLED, un solo accento saturo (il rosso dello stemma, campionato dal file ufficiale: `#CC1111`), tipografia condensata per numeri e titoli, blocchi netti.

La home apre con lo stemma grande e il nome del club su una foto aerea dello Zaccheria velata di rosso, poi scorciatoie, la partita di riferimento su scheda in tinta accento, carosello del calendario, numeri della stagione, classifica compatta e notizie.

## Stato verificato

Ultima verifica: 4 settembre 2026, con dati reali scaricati al momento.

- 34 test sui parser, tutti verdi, su snapshot reali in `services/ingest/__fixtures__/`
- ingest completo: 39 partite, classifica a 20 righe, 30 giocatori, 41 notizie, 20 squadre
- typecheck dell'app senza errori
- schermate provate su Chrome a viewport 390×844: home, partite, rosa, stadio, news, classifica, dettaglio partita, scheda giocatore
- stadio 3D: 1290 triangoli, cinque settori, raycast corretto su tutti e cinque, selezione che evidenzia la gradinata e apre la scheda del settore

Gli screenshot stanno in `docs/screenshots/`.

Non verificato: l'esecuzione su iPhone o Android. Serve Xcode installato per il simulatore iOS; su questa macchina manca. Una volta installato:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## Prima di pubblicare

Vedi `docs/PITCH.md`. In sintesi: senza licenza del marchio l'app non passa la review di Apple e Google, e i biglietti si possono solo linkare a Vivaticket, mai vendere.
