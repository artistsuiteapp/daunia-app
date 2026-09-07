# Il Tifo della Daunia — recap completo

App per i tifosi del Calcio Foggia 1920. **Progetto indipendente**, non affiliato
al club. Aggiornato al 8 settembre 2026.

Questo file esiste per riprendere il lavoro in una chat nuova senza perdere
niente: cosa c'è, come funziona, cosa manca, e le decisioni prese con il
perché — che è la parte che non si ricostruisce leggendo il codice.

---

## In due righe

- **Codice**: `~/dev/daunia-app`, repository privato `artistsuiteapp/daunia-app`
- **Online**: <https://daunia.vercel.app> (PWA, da aggiungere alla schermata Home)
- **Stack**: Expo / React Native (iOS, Android e web dallo stesso codice), Supabase, GitHub Actions
- **Stato**: 116 commit, 27 migrazioni, 21 schermate, **208 test**

---

## Come si consegna

```bash
cd ~/dev/daunia-app
npm test                    # 208 test
npx tsc --noEmit -p apps/mobile
npm run build:web
npx vercel --prod --yes
npx vercel alias set <url-del-deploy> daunia.vercel.app   # NON si sposta da solo
```

L'alias è il passo che si dimentica: senza, il sito resta al deploy precedente.

Da GitHub Actions il deploy è automatico dopo ogni aggiornamento dei dati
(serve `VERCEL_TOKEN`, già impostato).

---

## Le funzioni

### Partite

- **Punteggio dal vivo** col minuto vero, recupero compreso (`45+5`)
- **Cronaca completa**: gol, cartellini e sostituzioni con chi entra e chi esce
- **Formazioni ufficiali** con il modulo vero e l'allenatore
- **Notifiche push**: formazioni, inizio, gol, espulsioni, fine primo tempo, fine
- Il minuto **scorre da solo** fra un aggiornamento e l'altro, non salta

### Community

- **Curva**: discussioni per argomento, con modifica e cancellazione dei propri
  messaggi, salto all'ultima risposta e caricamento a 30 per volta
- **Chat dal vivo**: apre 10 minuti prima del fischio, chiude 20 dopo il triplice
  vero. Legge chiunque, scrive chi ha un account
- **Filtro parolacce e bestemmie**: gira nel database, non nel telefono

### Gioco

- **Pronostici** con classifica
- **Pagelle**: voto da 4 a 10 per ogni giocatore della formazione vera
- **Migliore in campo**: si vota 24 ore dopo il fischio, poi resta il verdetto,
  sparisce il giorno prima della gara successiva
- **Migliore del mese**: chiude l'ultimo giorno del mese, il verdetto resta fino
  alla chiusura di quello dopo

### Altro

- **Trasferte**: stato del divieto, chi ci va, da dove si parte
- **Stadio in 3D** con i settori e chi ha detto che c'è
- **Biglietti**: solo link a Vivaticket, mai vendita diretta
- **News** scritte dalla redazione

---

## Da dove arrivano i dati

| Dato | Fonte | Costo |
|---|---|---|
| Calendario, classifica, rosa | Wikipedia | 0 |
| Punteggio e minuto dal vivo | TheSportsDB `livescore.php` (chiave pubblica `123`) | 0 |
| Marcatori, cartellini, sostituzioni | live-score-api (competizione **181**) | trial fino al 21 settembre |
| **Formazioni ufficiali e modulo** | **seriec.com** (endpoint AJAX del calendario) | **0** |
| Stemmi e comunicati | sito del club (WordPress REST) | 0 |

### Le tre cose da sapere sulle fonti

**TheSportsDB: `livescore.php`, non `lookupevent.php`.** Il secondo è la scheda
dell'evento e arriva minuti in ritardo: durante Foggia‑Cerignola diceva ancora
"HT" mentre si giocava il 48°. Il primo porta anche `strProgress`, cioè il
minuto vero. Il filtro per lega viene ignorato, quindi la risposta è ~64 KB con
tutte le partite del mondo: la scarica il guardiano sul server, non il telefono.

**seriec.com: non è scraping di una pagina.** Il calendario ha un endpoint AJAX
(October CMS) con un id opaco per partita:

```
POST https://www.seriec.com/calendario
  X-OCTOBER-REQUEST-HANDLER: onLoadMatchDetails
  match_id=<id>
```

Un id non cambia quando cambia il layout, quindi è molto più stabile di un
selettore CSS. Il loro `robots.txt` consente tutti i bot: le uniche esclusioni
sono i crawler di addestramento AI.

**La partita compare nel calendario al calcio d'inizio**, non prima e non a fine
gara. Verificato: a 20, 10 e 0 minuti dal fischio non c'era id; alle 21:00 con
la gara al 10' c'erano id, formazioni e cronaca. Il guardiano cerca da lì.

### Le fonti scartate, con la prova

Non rifare questa ricerca:

- **API-Football** — copre tutto, ma **due account sospesi in 24 ore**. Il
  secondo con **una sola chiamata fatta**: non è la quota, è che la stessa
  chiave arriva da IP diversi (Mac, Supabase, GitHub Actions)
- **live-score-api**: le formazioni sono **barrate** fino al piano da €26. Nel
  trial e nello Starter da €11 ci sono solo eventi e punteggi
- **TheSportsDB** `lookuptimeline` / `lookuplineup` → `null` **anche per la
  Serie A**: è il limite della chiave gratuita, non la copertura
- **Highlightly** — 14 partite italiane in catalogo, tutte Serie A/B/Women. La
  sua "Serie C" è **brasiliana**
- **Sportmonks free** — solo Danimarca e Scozia
- **SoccerData API** — Italia solo Serie A/B/Coppa, a pagamento
- **Diretta.it / Flashscore** — vietato dai termini, e hanno anti-bot
- **Apify su FlashScore** — stesso problema, più il diritto *sui generis* sulle
  banche dati in Europa

---

## Come sta in piedi

### Il guardiano (Supabase Edge Function)

`supabase/functions/guardiano-partita/` — svegliato da pg_cron **ogni minuto**.

Fuori dalla finestra di una partita esce senza chiamare niente: è la regola che
tiene i consumi a zero nei giorni in cui non si gioca.

Dentro la finestra:

1. legge punteggio e minuto da `livescore.php`
2. quando il punteggio cambia, chiede i marcatori
3. dal calcio d'inizio cerca le formazioni sul sito della Lega, ogni 3 minuti,
   e smette appena le trova
4. scrive tutto in `stato_partita`; l'app legge in tempo reale, **senza deploy**

### Il punteggio ha tre fonti che si controllano

Il tabellone di TheSportsDB, i gol contati dagli eventi di API-Football, e
`fixtures?id=` come arbitro quando i primi due litigano.

**Il numero si stampa solo se due fonti concordano.** Se litigano, la notifica
dice "GOL DEL FOGGIA!" con minuto e marcatore e tace il punteggio: prima
prendeva il gol da una fonte e il numero dall'altra, e annunciava "GOL DEL
FOGGIA! 0-0" proprio quando serviva.

### Il freno sulla quota

`quota_af` più `chiedi_quota(quante, tetto)`: incrementa e decide nella stessa
transazione. **Se il database non risponde, la risposta è no** — perdere il nome
di un marcatore costa meno che perdere l'account.

Il conto sta in Postgres e non in memoria perché la funzione muore a ogni giro:
un contatore locale ripartirebbe da zero ogni minuto.

### L'ingest (GitHub Actions)

`services/ingest/run.mjs`, ogni 30 minuti, e **ogni 10 nelle ore delle partite**
(sab-dom 12–22, mar-mer 16–22). Committa i dati e ripubblica il sito.

---

## Come si vota (la domanda che è venuta fuori)

**Serve un account.** Senza, la scala dei voti non compare: si vede solo la
media, e un riquadro che dice perché.

Ci sono **due voti diversi**, e non vanno confusi:

**Il migliore in campo** — scheda partita → Pagelle, in cima. Si sceglie **un
nome solo** fra chi è sceso in campo: si tocca la riga del giocatore. Vince chi
prende più preferenze, come un'elezione.

**Le pagelle** — sotto, una fila di numeri **da 4 a 10** per ogni giocatore.

Sono due domande diverse: uno può dare 7 a tutta la squadra e pensare comunque
che il migliore sia stato il portiere, e nella media quel pensiero non si vede.
Il migliore viene prima perché è la domanda più facile: si risponde d'istinto,
mentre mettere undici voti è un lavoro.

**Il migliore del mese** è ancora un'altra cosa: si vota in home, fra chi ha
giocato almeno una partita del mese, e si può cambiare idea fino all'ultimo
giorno.

Tutti e tre si cambiano finché la finestra è aperta.

I voti singoli **restano privati**: le medie le calcola il database con funzioni
dedicate (`medie_voti`, `migliore_partita`, `migliore_mese`), e l'app riceve solo
il risultato.

Minimi perché un premio compaia: **3 voti** per il migliore in campo, **10** per
il migliore del mese. Senza, il primo che vota decide da solo.

---

## Regole che non si toccano

**Niente fotografie di terzi.** In tutta l'app non c'è una foto che non sia
nostra: gli stemmi si collegano, non si copiano, e gli sfondi sono disegnati
(`SfondoCurva`, `SfondoCitta`). `apps/mobile/lib/media.ts` ha `photos: false`.

**Biglietti solo come link a Vivaticket.** Mai vendita, mai rivendita: L. 232/2016,
sanzioni AGCOM fino a 180.000 € per evento. E **non si salvano codici a barre**:
sono credenziali al portatore su biglietti nominativi.

**I divieti di trasferta si propongono, non si pubblicano.** Un divieto sbagliato
fa perdere un viaggio a qualcuno. Il riconoscimento legge la stampa locale e,
quando tace per una trasferta imminente, **lo segnala** invece di far finta che
sia tutto aperto.

**Il divieto colpisce i residenti in provincia di Foggia**, non chiunque. Chi
risiede altrove di solito può comprare: è la frase per cui la sezione Trasferte
esiste, perché 69.689 foggiani iscritti all'AIRE non lo sanno.

**Niente dati inventati.** Sono stati tolti tutti: discussioni finte, presenze
allo stadio generate, medie delle pagelle derivate dal nome del giocatore,
classifica pronostici con avversari inventati, "Mario Rossi", prezzi dei
biglietti scritti a mano. I test che verificavano il riempimento simulato adesso
verificano che **non esista**.

**Il segreto Supabase non deve mai avere il prefisso `EXPO_PUBLIC_`** né stare
in `apps/mobile`: bypassa tutte le regole di riga.

---

## Segreti e dove stanno

| Nome | Dove | A cosa serve |
|---|---|---|
| `LSA_KEY`, `LSA_SECRET` | GitHub + `.env.livescore` | live-score-api |
| `API_FOOTBALL_KEY`, `API_FOOTBALL_VIA` | GitHub + Supabase | API-Football (sospeso) |
| `VERCEL_TOKEN` | GitHub | deploy automatico |
| `VAPID_JWK`, `VAPID_PUBLIC` | Supabase | notifiche push |
| `guardiano_segreto` | **Supabase Vault** | autentica il cron |

Il segreto del guardiano sta in Vault e **non nelle migrazioni**: una migrazione
finisce nel repository, e un segreto in un repository è un segreto perso.

---

## Cosa manca

**Le email di registrazione non partono.** Supabase consegna solo al proprietario
del progetto, 2 all'ora. Serve un SMTP proprio (Resend è già studiato, vedi
`docs/EMAIL.md`): serve un dominio verificato. Finché non è risolto **non
esiste un secondo account**, quindi chat, contatti reciproci e pagelle non sono
mai stati provati in due.

**Vercel Hobby vieta l'uso commerciale.** Prima della raccolta fondi l'hosting va
spostato — Cloudflare Pages è l'alternativa studiata.

**Il commercialista** prima di aprire la raccolta: le donazioni a una persona
fisica non sono automaticamente esenti. Obiettivo 500 €, testi in
`docs/RACCOLTA-FONDI.md`.

**Google Data Safety e le privacy label di Apple** vanno compilate a mano.

**Le notifiche restano web push** finché l'Apple ID è gratuito: l'entitlement
APNs non viene concesso, e servirebbe l'account sviluppatore a 99 €/anno. Su
Android funzionano anche senza aggiungere alla Home; su iPhone **solo** se l'app
è stata aggiunta alla schermata Home.

---

## File da leggere per primi

| File | Cosa contiene |
|---|---|
| `docs/DATI-PARTITA.md` | le fonti, i limiti, il budget delle chiamate |
| `services/ingest/run.mjs` | l'ordine in cui i dati vengono raccolti |
| `supabase/functions/guardiano-partita/index.ts` | tutto quello che succede durante una partita |
| `apps/mobile/lib/live.ts` | come l'app riceve il dal vivo |
| `apps/mobile/lib/*-core.ts` | i conti che possono sbagliare, tutti sotto test |

I file `*-core.ts` sono senza React e senza dati apposta: `filtro-core`,
`live-core`, `modulo-core`, `premi-core`, `ritaglio-core`, `punteggio.ts`. Se
cambi qualcosa lì, i test lo dicono subito.

---

## La prossima prova

**Sabato 12 settembre, Monopoli–Foggia, 18:00.** È la prima partita con tutto
insieme: formazioni, cronaca, chat, notifiche, pagelle e premi.

Cosa guardare, in ordine:

1. la chat apre alle 17:50
2. al fischio compaiono le formazioni con il modulo
3. i gol arrivano come notifica entro un minuto o due
4. a fine partita la finestra dei voti si apre per 24 ore
5. il giorno dopo il migliore in campo compare in home
