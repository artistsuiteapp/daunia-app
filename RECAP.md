# Il Tifo della Daunia — recap completo

App per i tifosi del Calcio Foggia 1920. **Progetto indipendente**, non affiliato
al club. Aggiornato al 14 settembre 2026.

Questo file esiste per riprendere il lavoro in una chat nuova senza perdere
niente: cosa c'è, come funziona, cosa manca, e le decisioni prese con il
perché, che è la parte che non si ricostruisce leggendo il codice.

---

## In due righe

- **Codice**: `~/dev/daunia-app` (percorso completo `/Users/salvatorepapa/dev/daunia-app`), repository **pubblico** `artistsuiteapp/daunia-app`
- **Dove gira**: app nativa sull'iPhone, installata con Xcode. Il sito <https://daunia.vercel.app> esiste ancora ma non è più il prodotto: si pubblica solo a mano
- **Dominio**: `iltifodelladaunia.it`, comprato su IONOS. Vetrina pronta in `sito/index.html`, non ancora pubblicata
- **Stack**: Expo SDK 57 / React Native 0.86 (iOS, Android e web dallo stesso codice), Supabase, GitHub Actions
- **Stato**: 375 commit (169 senza gli aggiornamenti automatici dei dati), 46 migrazioni, 38 schermate, **467 test**

Il repository è pubblico dall'8 settembre, e non è una svista: sui repo pubblici
i minuti di GitHub Actions sono gratis e illimitati. Sono attivi secret scanning
e push protection. **Mai scrivere in un file committato email, chiavi o dati
personali.**

---

## Come si lavora

```bash
cd ~/dev/daunia-app
npm test                           # 467 test, compresi gli attacchi al database
npx tsc --noEmit -p apps/mobile    # zero errori
```

### Sul telefono

```bash
cd ~/dev/daunia-app/apps/mobile && npm run telefono
```

È `expo run:ios --device --configuration Release`. Release è obbligatorio: in
Debug il JavaScript lo serve il Mac e l'app funziona solo accanto al computer.
iPhone collegato col cavo e sbloccato.

- Firma con Apple ID gratuito (Personal Team `494J598S2V`, bundle `io.daunia.app`): **dura 7 giorni**, poi si rilancia lo stesso comando
- Servono **~8 GB liberi** sul Mac. Per fare spazio si cancellano `~/Library/Developer/Xcode/DerivedData/*` e le cache, **mai il runtime del simulatore**: in Xcode 26 è lo stesso componente che serve per compilare sul telefono vero, e riscaricarlo costa 8,5 GB
- Se il progetto nativo va rigenerato: `npm run prebuild:ios`. Toglie da solo l'entitlement delle notifiche push, che con l'account gratuito fa fallire la firma con un errore che non nomina mai le notifiche

### Database e guardiano

```bash
npx supabase db push --linked                   # le migrazioni: le lancia Salvatore
npx supabase functions deploy guardiano-partita
```

Al 14 settembre il database vero è allineato a tutte le migrazioni.

### Il sito

Non si pubblica più da solo. `pubblica.yml` parte solo a mano da GitHub. L'ingest
non pubblica più niente su Vercel: il tetto gratuito di 100 pubblicazioni al
giorno si esauriva e una notte ha prodotto 25 email di errore.

---

## Da dove l'app prende i dati

L'app installata **non aspetta un aggiornamento per avere dati freschi**. A ogni
apertura scarica `data/bundle.json` direttamente dal repository
(`raw.githubusercontent.com`) e sostituisce calendario, classifica, rosa,
formazioni e rassegna senza ricompilare (`lib/bundle-remoto.ts`). Le schermate si
ridisegnano perché `Screen` si iscrive all'arrivo del bundle nuovo.

Il dal vivo (punteggio, minuto, cronaca) arriva da Supabase in tempo reale.

Nel profilo, `StatoDati` dice da quanto sono fermi i dati: niente sotto l'ora, un
avviso tra 1 e 6 ore, un avviso più forte sopra.

| Dato | Fonte | Costo |
|---|---|---|
| Calendario, classifica, rosa | Wikipedia, via ingest | 0 |
| Punteggio e minuto dal vivo | TheSportsDB `livescore.php` (chiave pubblica `123`) | 0 |
| Marcatori, cartellini, sostituzioni | **live-score-api** (Serie C = competizione **181**) | prova fino al **~21 settembre** |
| Formazioni ufficiali e modulo | sito della Lega, endpoint AJAX | 0 |
| Rassegna stampa | RSS delle tre testate autorizzate | 0 |
| Stemmi e comunicati | sito del club (WordPress REST) | 0 |

### Le cose da sapere sulle fonti

**TheSportsDB: `livescore.php`, non `lookupevent.php`.** Il secondo arriva minuti
in ritardo. Il primo porta `strProgress`, il minuto vero col recupero.

**live-score-api: i nomi degli eventi si copiano dai loro documenti.** Il primo
giro li aveva indovinati e un gol su rigore spariva dal tabellino senza errore.
Sono `GOAL · GOAL_PENALTY · OWN_GOAL · YELLOW_CARD · RED_CARD · YELLOW_RED_CARD ·
SUBSTITUTION · MISSED_PENALTY`. La `253` è la Serie C **brasiliana**. Dopo la prova
serve lo Starter a **11 €/mese**, altrimenti spariscono marcatori e cartellini.

**La Lega apre la partita al calcio d'inizio.** A 20, 10 e 0 minuti dal fischio
non c'è id. Gli id stanno in cache in `data/legapro-ids.json`: fino al 13
settembre la cache non si rileggeva mai, e ogni partita aperta dopo il 7 era
invisibile. Ora, se una partita manca, la lista si ricarica.

### Le fonti scartate, con la prova

Non rifare questa ricerca:

- **API-Football**: sospeso **tre volte** (6 e 12 settembre). Cento chiamate al giorno non bastano. Il codice ha ancora la strada come ripiego, ma non è una fonte viva
- **live-score-api per le formazioni**: `matches/lineups` risponde vuoto anche su Serie A e B
- **TheSportsDB** `lookuptimeline` / `lookuplineup` → `null` anche per la Serie A: è il limite della chiave gratuita
- **Highlightly**: la sua "Serie C" è brasiliana
- **Sportmonks free**: solo Danimarca e Scozia
- **SoccerData API**: Italia solo Serie A/B/Coppa, a pagamento
- **Diretta.it / Flashscore** e **Apify**: vietato dai termini, anti-bot, diritto sulle banche dati
- **Sito del club per le foto della rosa**: fermo al 26 aprile 2026

---

## Come sta in piedi

### Gli orologi

Il cron di GitHub **non è affidabile**: sabato 6 settembre doveva fare ~60 giri e
ne ha fatti 5. Su un repo pubblico gratuito la coda è sempre piena.

L'orologio vero è **pg_cron su Supabase**, che non ha mai saltato un giro:

| Lavoro | Ogni | Cosa fa |
|---|---|---|
| `guardiano-partita` | minuto | segue la partita |
| `sveglia-ingest` | 20 minuti | chiama GitHub per far partire l'ingest (`workflow_dispatch`) |

I cron di GitHub restano come rete di sicurezza. Attenzione: i giri automatici
dell'ingest **sono** `workflow_dispatch`, non `schedule`, perché li lancia pg_cron.
Una condizione scritta pensando il contrario ha già fatto danni una volta.

Il token GitHub sta in Supabase Vault come `github_gettone` (solo `Actions: read
and write` su questo repository).

Da togliere quando capita: `select cron.unschedule('prova-formazioni-catania');`,
un residuo di una prova del 7 settembre.

### Il guardiano (Supabase Edge Function)

`supabase/functions/guardiano-partita/`. Fuori dalla finestra di una partita esce
senza chiamare niente.

Dentro la finestra:

1. legge punteggio e minuto da `livescore.php`
2. rilegge gol, cartellini e cambi da live-score-api **ogni minuto**
3. dal calcio d'inizio cerca le formazioni sul sito della Lega ogni 3 minuti
4. scrive tutto in `stato_partita`, e l'app lo riceve in tempo reale
5. manda le notifiche: formazioni, inizio, gol, espulsioni, intervallo, fine, e un'ora prima il promemoria del pronostico (con l'orario, non "manca un'ora")

Ogni mezz'ora passa anche il calendario al database (`allinea_calendario`).

Tre regole scritte dopo averle sbagliate:

- **Quello che si sa non si perde.** Una lettura vuota non cancella gol, cartellini e cambi già scritti (`proteggi()` in `punteggio.ts`)
- **Una partita già salvata non si riscrive.** Nelle ore dopo il fischio TheSportsDB indica ancora come "prossima" la partita appena giocata, e il guardiano la riscriveva con il punteggio vuoto
- **Il punteggio si stampa solo se due fonti concordano.** Altrimenti la notifica dice "GOL DEL FOGGIA!" col minuto e tace il numero

### Il ponte fra i due numeri di una partita

L'app chiama le partite `wp-2026-2027-004`, il guardiano `2555023`. Fino al 13
settembre nessuno dei due trovava i pronostici dell'altro: il pronostico non si
chiudeva al fischio lato server, e **nessuno ha mai preso i punti per esito o
risultato**.

Ora c'è la tabella `calendario`, riempita dal guardiano, e il ponte si fa
sull'orario del calcio d'inizio. `allinea_calendario` rimette i punteggi
cancellati, chiude le partite rimaste aperte e paga i punti arretrati. È
ripetibile: non paga mai due volte.

### L'ingest (GitHub Actions)

`services/ingest/run.mjs`. Scarica, normalizza, committa `data/`. Quattro passi, e
nessuno pubblica il sito. La rassegna stampa si rilegge se è più vecchia di un
quarto d'ora.

---

## Le funzioni

### Partite

- **Punteggio dal vivo** col minuto vero, recupero compreso
- **Cronaca** a parole: "Zuccon, entra al posto di Coulibaly", "ammonito", "gol su rigore". Solo sulla partita che si sta giocando
- **Formazioni ufficiali** col modulo, e nomi sul campo che non si sovrappongono
- **Statistiche** che contano anche la partita appena finita, senza aspettare l'ingest

### Match Center

L'ingresso della sezione di gioco, con quattro porte: pagelle, premi,
pronostici, classifica dei tifosi.

- **Pronostico**: uno per partita, si chiude al fischio d'inizio (lo impone il database)
- **Pagelle**: voto da 4 a 10 per ogni giocatore della formazione vera
- **Migliore in campo**: si vota nelle 24 ore dopo il fischio, servono 3 voti
- **Migliore del mese**: si vota tutto il mese, servono 10 voti
- **Sondaggi** scritti dall'admin. I quiz sono stati tolti

I voti singoli restano privati: le medie le calcola il database.

### Punti, livelli, badge

| Azione | Punti |
|---|---|
| Pronostico fatto | 10 |
| Esito indovinato | 50 |
| Risultato esatto | 100 |
| Pagelle, migliore in campo, sondaggio, condivisione | 5 |

I punti li scrive **solo il database**, con trigger. Si danno solo per partite che
esistono nel calendario: prima 500 pronostici su partite inventate valevano 5.000
punti. Livelli: Occasionale (da 0), Rossonero (250), Ultras (1.000), Leggenda (3.000).
Classifiche per settimana, mese e stagione.

### Community

- **Curva**: discussioni per argomento, con modifica e cancellazione dei propri messaggi
- **Chat dal vivo**: apre 10 minuti prima del fischio. Legge chiunque, scrive chi ha un account
- **Filtro parolacce e bestemmie** nel database: copre la parola, non rifiuta il messaggio
- **Segnalazione e blocco** su ogni contenuto altrui. Alla terza persona diversa che segnala, il contenuto si nasconde da solo; respingere la segnalazione lo rimette in chiaro
- **Profilo pubblico** di ogni persona, con livello e badge

### Pannello admin (dentro l'app)

Utenti (promuovi, sospendi, revoca), segnalazioni, contenuti nascosti, chi è
online, numeri dell'app. Il primo account registrato è diventato admin da solo
(`20260912110000_primo_admin.sql`). Ruoli e sospensioni passano **solo** dalle
funzioni del pannello: dalla tabella non li può toccare nessuno, nemmeno un admin.

### Altro

- **Trasferte**: stato del divieto, chi ci va, contatti visibili solo a chi va alla stessa trasferta e non tra chi si è bloccato
- **Stadio in 3D** con i settori e chi ha detto che c'è
- **Biglietti**: solo link a Vivaticket
- **Notizie**: rassegna delle tre testate autorizzate, e i comunicati del club come titolo e link
- **Account**: registrazione, accesso, recupero password con la schermata per sceglierla (le email riportano a `daunia://`), cancellazione dell'account dall'app

---

## La rassegna stampa

Tre testate hanno autorizzato per iscritto la presenza dei loro articoli:

| Testata | Contatto | Feed |
|---|---|---|
| CalcioFoggia.it | `redazione@calciofoggia.it` | `/feed/` |
| Foggiacalciomania | `redazione@foggiacalciomania.com` | `/feed/` |
| ilFoggia.com | `ilfoggiainfo@gmail.com` | `/feed/` |

**La regola a cui hanno detto di sì, e che non si tocca**: entrano titolo, link,
data e il sommario tagliato a 180 caratteri. Il corpo mai, nemmeno quando il feed
lo porta. Un test fallisce se qualcuno aggiunge il campo. L'anteprima è la loro
`og:image`, collegata e non copiata.

L'articolo si apre col browser di sistema (`lib/apri.ts`), così per la testata
resta una visita normale. Solo indirizzi `http` e `https`.

Per aggiungere una testata: sei righe in `TESTATE` dentro
`services/ingest/src/sources/stampa.mjs`. Per toglierla: `attiva: false`.

ilFoggia.com non pubblica dal 7 settembre: è muta di suo, non è un guasto nostro.

---

## Sicurezza

Audit del 13 settembre: tutte le migrazioni caricate su un Postgres vero (PGlite)
e attaccate da un utente qualsiasi e da un anonimo. Gli attacchi riusciti ora
sono test che girano a ogni `npm test`:

- `supabase/test/tutte-le-migrazioni.mjs` carica il database completo, con auth, storage, cron e vault finti
- `supabase/test/sicurezza-sql.test.mjs` contiene gli attacchi

Cosa riusciva e ora no: rendere visibile un post nascosto dai moderatori, fissarlo
in cima, farsi punti con partite inventate, cancellare o dirottare le iscrizioni
alle notifiche, inserire segnalazioni già "accolte", allagare la chat, far
riscrivere a un moderatore i testi altrui, togliere il ruolo a un altro admin,
caricare una foto profilo da un server qualsiasi, comparire nel pannello come
un'altra persona, mandare migliaia di eventi anonimi.

Nell'app: un collegamento `daunia://` costruito apposta non blocca più
l'app (`lib/decodifica-uri.js`, caricato da Metro al posto di
`decode-uri-component`).

Regola dei trigger: `current_user in ('anon', 'authenticated')` vuol dire "l'ha
chiesto un telefono". Dentro una funzione `security definer` è il proprietario.

**Il segreto Supabase non deve mai avere il prefisso `EXPO_PUBLIC_`** né stare in
`apps/mobile`: scavalca tutte le regole.

---

## Leggibilità (utenti sopra i 45 anni)

Rifatta il 13 settembre seguendo le linee guida Apple. Audit completo:
<https://claude.ai/code/artifact/65c5e7ec-ebb9-491b-a2af-868c918844f2>

Regole ora nel codice, da non disfare:

- Scala tipografica alla taglia iOS **xLarge** (`theme/tokens.ts`): corpo 19, minimo 14. Niente `fontSize` scritti sotto 13
- Contrasto misurato: il testo più tenue sta sopra 5,5:1
- Pulsanti alti almeno 44 punti (`TOCCO_MINIMO`), righe di lista 52
- **Cinque voci** nella barra in basso: Home, Partite, Curva, Stadio, News. Rosa e Trasferte stanno nelle scorciatoie della home
- Home: prossima partita in cima, poi le sei scorciatoie in griglia (Match Center, Biglietti, Rosa, Trasferte, Classifica del girone, Statistiche)
- Niente contenuti che cambiano da soli, e ogni animazione continua si ferma con "Riduci movimento"
- Etichette in minuscolo normale, mai TUTTO MAIUSCOLO
- Ogni pulsante fatto solo di icona ha un nome per VoiceOver

**Non ancora provato sul telefono**: testo grande di iOS e VoiceOver.

---

## Regole che non si toccano

**Niente fotografie di terzi.** Gli stemmi si collegano, non si copiano, e gli
sfondi sono disegnati. `apps/mobile/lib/media.ts` ha `photos: false`. Passano
solo le foto profilo caricate sul nostro archivio.

**Biglietti solo come link a Vivaticket.** Mai vendita, mai rivendita (L. 232/2016),
e **non si salvano codici a barre**.

**Transfermarkt** solo come lettura a mano una tantum, mai come fonte automatica,
mai le loro immagini.

**I divieti di trasferta si propongono, non si pubblicano.** Un divieto sbagliato
fa perdere un viaggio a qualcuno.

**Niente dati inventati.** Discussioni finte, presenze generate, medie derivate dal
nome, avversari inventati: tutto tolto, e i test verificano che non torni.

**Quando si aggiunge una fonte o una cache, si aggiunge insieme il modo di
accorgersi che ha smesso.** Il difetto ricorrente di questo progetto non sono stati
i bug ma i guasti che non si annunciavano.

---

## Segreti e dove stanno

| Nome | Dove | A cosa serve |
|---|---|---|
| `LSA_KEY`, `LSA_SECRET` | GitHub + Supabase | live-score-api |
| `API_FOOTBALL_KEY`, `API_FOOTBALL_VIA` | GitHub + Supabase | API-Football (ripiego, sospeso) |
| `VERCEL_TOKEN` | GitHub | pubblicazione manuale del sito |
| `VAPID_JWK`, `VAPID_PUBLIC` | Supabase | notifiche web push |
| `guardiano_segreto` | **Supabase Vault** | autentica il cron del guardiano |
| `github_gettone` | **Supabase Vault** | pg_cron sveglia l'ingest |

I segreti in Vault **non stanno nelle migrazioni**: una migrazione finisce nel
repository pubblico.

---

## Cosa manca

**Entro il 21 settembre: live-score-api Starter, 11 €/mese.** Senza, dopo la
prova spariscono marcatori, cartellini e cambi.

**Account Apple Developer, 99 €/anno.** Senza non si pubblica sull'App Store, non
c'è TestFlight, l'app installata scade ogni 7 giorni e **non riceve notifiche
push** (le web push arrivano solo dalla PWA aggiunta alla Home).

**Google Play Console, 25 $ una volta.** Un account personale nuovo deve fare un
test chiuso con almeno 12 persone per 14 giorni prima di pubblicare. Android non è
mai stato compilato, e senza Firebase le push su Android non partono.

**Prima di pubblicare sugli store:**

- EAS Update, per mandare aggiornamenti senza revisione. Va messo prima della prima versione pubblica
- Un secondo progetto Supabase di prova, perché oggi ogni prova tocca il database vero
- I test che girano da soli su GitHub a ogni push
- Un account di prova per i revisori Apple
- Privacy label di Apple e Data Safety di Google, da compilare a mano
- Informativa privacy e condizioni su un indirizzo pubblico (il dominio c'è)
- L'informativa è una bozza: va rivista da un professionista

**Hosting**: Vercel Hobby vieta l'uso commerciale. Il sito non serve all'app, ma
se resta va spostato (Cloudflare Pages o GitHub Pages).

**Email**: verificare che conferma e recupero arrivino anche a indirizzi diversi
da quello del proprietario. Supabase senza SMTP proprio ne consegna poche l'ora
(Resend studiato in `docs/EMAIL.md`).

**Il commercialista** prima della raccolta fondi: le donazioni a una persona
fisica non sono automaticamente esenti. Testi in `docs/RACCOLTA-FONDI.md`.

**Il battito del guardiano**: fuori partita non scrive niente, quindi non si sa se
pg_cron è vivo finché non comincia una gara. Basterebbe una colonna `visto_il`
scritta a ogni giro. Intanto: `select jobname, schedule, active from cron.job;`

**Rischi bassi aperti**: le zone della classifica si distinguono a colpo d'occhio
solo dal colore.

---

## File da leggere per primi

| File | Cosa contiene |
|---|---|
| `docs/DATI-PARTITA.md` | le fonti, i limiti, il budget delle chiamate |
| `services/ingest/run.mjs` | l'ordine in cui i dati vengono raccolti |
| `supabase/functions/guardiano-partita/index.ts` | tutto quello che succede durante una partita |
| `supabase/migrations/20260913120000_sicurezza_e_calendario.sql` | calendario, ponte fra gli id, protezioni |
| `apps/mobile/lib/bundle-remoto.ts` | come l'app installata prende i dati freschi |
| `apps/mobile/lib/live.ts` | come l'app riceve il dal vivo |
| `apps/mobile/theme/tokens.ts` | caratteri, colori e misure di tutta l'interfaccia |
| `apps/mobile/lib/*-core.ts` | i conti che possono sbagliare, tutti sotto test |

I file `*-core.ts` sono senza React e senza rete apposta. Se cambi qualcosa lì, i
test lo dicono subito.

---

## La prossima prova

**Martedì 15 settembre, Foggia–Savoia, 21:00.** È la prima partita con il ponte fra
gli id, il calendario nel database e la nuova interfaccia.

Prima, sul telefono: ricompilare l'app (`npm run telefono`), perché la versione
installata è di prima delle modifiche del 13.

Cosa guardare, in ordine:

1. alle 20:00 il promemoria del pronostico, solo a chi non l'ha fatto
2. alle 20:50 apre la chat
3. alle 21:00 il pronostico non si può più cambiare
4. dopo il fischio compaiono le formazioni col modulo
5. gol, cartellini e cambi compaiono in cronaca entro un minuto o due
6. a fine partita i punti per esito e risultato arrivano in classifica
7. il giorno dopo il risultato è ancora lì, e non torna vuoto
