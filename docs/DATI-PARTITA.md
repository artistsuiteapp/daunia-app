# Da dove arrivano i dati delle partite

Verificato il 5 settembre 2026 con una chiave vera, non dedotto dalla documentazione.

## Cosa dà API-Football sulla Serie C

Girone C, lega **943** (A = 138, B = 942). Foggia = squadra **521**.

| Dato | Serie C | Coppa Italia Serie C |
|---|---|---|
| Formazioni | **sì** | no |
| Eventi: gol, cartellini, sostituzioni col minuto | **sì** | sì |
| Statistiche partita: possesso, tiri, falli | **no** | no |
| Modulo (4-3-3 ecc.) | no, torna vuoto | no |
| Ruolo del giocatore | no, torna vuoto | no |
| Dati sui singoli giocatori | no | no |

Provato davvero: su Guidonia–Foggia del 27 aprile 2024 tornano gli undici titolari
con numero e cognome, tredici in panchina, l'allenatore, e tredici eventi.

**Le statistiche di fine partita non arrivano nemmeno pagando.** La Serie C non
è coperta per quelle. Chi le vuole deve guardare altrove, per esempio Sportmonks,
che dichiara statistiche complete sui tre gironi.

## Il vincolo che decide tutto

Il piano gratuito arriva alla **stagione 2024**. Sulla stagione in corso risponde:

> Free plans do not have access to this season, try from 2022 to 2024.

Quindi, per quanto la Serie C sia coperta, con il piano gratuito questa app non
vede niente della stagione che sta giocando. Servono **19 dollari al mese**.

Il piano gratuito non dà nemmeno il parametro `last`, quindi le partite recenti
si prendono scaricando la stagione e filtrando a mano.

## Quanto costerebbe usarlo

Cento chiamate al giorno sul gratuito, settemilacinquecento sul piano da 19 dollari.

| A cosa serve | Chiamate |
|---|---|
| Formazioni ed eventi di una partita | 1 per l'elenco + 2 per partita |
| Notifica al gol, controllo ogni 90 secondi per due ore | 80 in quel giorno |
| Notifica al gol, controllo ogni 30 secondi | 240 in quel giorno |

Il limite è **al giorno**, e il Foggia gioca una o due volte a settimana: anche
il gratuito basterebbe come numero di chiamate. È la stagione il problema, non la quota.

## Com'è collegato adesso

`services/ingest/src/sources/apifootball.mjs` è scritto e provato. Nell'ingest è
**spento**, e si accende con `API_FOOTBALL_ENABLED=1`.

È spento apposta: il cron gira ogni mezz'ora, quindi lasciarlo acceso farebbe
quarantotto tentativi al giorno che il piano gratuito rifiuta, consumando quota
per niente.

La chiave sta nei segreti di GitHub come `API_FOOTBALL_KEY`, non nel codice.

## Cosa fare quando si sottoscrive il piano

1. Aggiungere al workflow `.github/workflows/ingest.yml`, nel passo dell'ingest:

   ```yaml
   env:
     API_FOOTBALL_ENABLED: '1'
     API_FOOTBALL_KEY: ${{ secrets.API_FOOTBALL_KEY }}
   ```

2. La formazione probabile passa da "costruita per ruolo" a "gli undici che
   hanno giocato l'ultima volta", che è quello che indovinerebbe un tifoso.

3. Restano fuori le statistiche di fine partita: quelle la Serie C non le ha.
