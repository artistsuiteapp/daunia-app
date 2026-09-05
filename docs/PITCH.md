# Proposta al Calcio Foggia 1920

Documento di lavoro per l'incontro. Non è materiale da consegnare così com'è.

## Il problema che l'app risolve

Il sito ufficiale è fermo. Verificato il 4 settembre 2026 interrogando direttamente la sua API pubblica:

- nessuna partita in calendario dopo agosto 2026, la stagione 2026-2027 non è mai stata caricata
- i risultati non sono mai stati compilati: il campo esiste ma è vuoto su tutte le partite
- la rosa è quella del 2025-2026, ultima modifica 25 settembre 2025, i nuovi acquisti non ci sono
- la classifica più recente è quella della stagione scorsa

L'unica sezione aggiornata sono i comunicati, pubblicati con regolarità.

Un tifoso che vuole sapere quando si gioca la prossima partita non lo trova sul sito della società. Lo trova su Wikipedia, su Transfermarkt, sui siti di risultati. Il traffico e l'attenzione vanno altrove, e con loro la vendita dei biglietti e la visibilità degli sponsor.

## Cosa c'è già pronto

Un'app funzionante su iPhone e Android con calendario, risultati con marcatori e minuto, classifica del girone, rosa, schede giocatore, notizie e una mappa 3D dello Zaccheria che porta alla biglietteria settore per settore.

Gira oggi, con dati veri, senza che la società debba fare nulla. I dati sportivi vengono ricostruiti da fonti pubbliche perché quelli della società non ci sono.

## Cosa serve dalla società

Quattro cose, in ordine di importanza.

**1. Licenza d'uso di marchio, stemma e colori.** Senza questa l'app non arriva sugli store: Apple (linea guida 5.2.1) e Google chiedono l'autorizzazione scritta del titolare del marchio e in sua assenza rifiutano la pubblicazione. È il punto bloccante, gli altri tre sono miglioramenti.

**2. I dati sportivi, in una delle due forme.** O un feed (anche un semplice foglio o un endpoint), oppure l'autorizzazione a compilare SportsPress sul sito, che è già installato e già espone tutto via API. La seconda strada costa meno e migliora anche il sito.

**3. Accesso ai dati di vendita Vivaticket.** Serve a mostrare la disponibilità reale per settore invece di una stima. È la funzione che spinge all'acquisto: si vede cosa resta e si compra dallo stesso schermo.

**4. La fototeca ufficiale.** Oggi solo tre giocatori su trenta hanno una foto, perché le uniche disponibili sono quelle della rosa dell'anno scorso.

## Cosa la società ottiene

- Un canale diretto verso i tifosi, con notifiche push su formazioni, gol e apertura vendite
- Un percorso di acquisto più corto: dalla mappa dello stadio a Vivaticket in due tocchi
- Uno spazio sponsor nativo, dentro un'app usata prima e durante ogni partita
- Dati su cosa guardano i tifosi, quali partite generano interesse, quali settori si consultano di più

## Vincoli che restano, anche con l'accordo

**I biglietti non si vendono dentro l'app.** La legge 232/2016 punisce la rivendita fuori dai canali autorizzati con sanzioni AGCOM fino a 180.000 euro per evento. L'app porta a Vivaticket, che resta il venditore. Con un accordo commerciale si può integrare l'acquisto in un browser interno, ma il venditore rimane Vivaticket.

**Niente video delle partite.** I diritti pay della Serie C sono di Sky per il triennio 2025-2028. Gli highlights si possono usare solo entro i limiti concessi al licenziatario, sette giorni dall'evento sulle piattaforme autorizzate. Qualsiasi contenuto video va concordato con la Lega, non con noi.

**Le foto hanno un autore.** Le immagini di giocatori e partite sono coperte da copyright di chi le ha scattate. Servono quelle della società o di un'agenzia con cui la società ha un contratto.

## Se la risposta è no

Il lavoro non si butta. L'app resta pubblicabile in versione indipendente: nome diverso, nessuno stemma, avviso "non affiliata al Calcio Foggia 1920" ben visibile, biglietti solo come collegamento esterno. I dati sportivi restano leciti perché risultati, calendario e classifica sono fatti, e i fatti non sono coperti da copyright.

Perde l'appeal del marchio e la possibilità di integrare la biglietteria. Ma esiste, funziona, e i tifosi la userebbero comunque.
