-- I cartellini e i cambi, mentre si gioca.

/*
 * IL PEZZO CHE MANCAVA, visto in Monopoli-Foggia del 12 settembre.
 *
 * Durante la partita il guardiano salvava solo i gol. I cartellini li vedeva
 * -- live-score-api li da insieme ai gol, nella stessa risposta -- ma non
 * aveva dove metterli, quindi nell'app non comparivano. Si vedevano solo il
 * giorno dopo, quando passava l'aggiornamento dati e li prendeva da capo.
 *
 * Per chi segue la partita dal telefono e' mezza cronaca: sai che si sta
 * perdendo ma non sai che siete in dieci.
 *
 * Stessa forma di `gol`: un elenco jsonb riscritto per intero a ogni lettura,
 * non righe da aggiornare una per una. La fonte manda sempre tutta la lista, e
 * rimpiazzare e' piu semplice che riconciliare -- e non puo lasciare orfani.
 */
alter table stato_partita
  -- [{minuto, chi, nostro, rosso}]
  add column if not exists cartellini jsonb not null default '[]'::jsonb,
  -- [{minuto, esce, entra, nostro}]
  add column if not exists cambi      jsonb not null default '[]'::jsonb;
