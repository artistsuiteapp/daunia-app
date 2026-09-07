-- Le formazioni per la via veloce.
--
-- Passando dall'ingest ci vogliono fino a venti minuti: dieci di attesa del
-- cron e dieci di ricostruzione del sito. Le formazioni ufficiali escono anche
-- a venti minuti dal fischio, quindi con quella strada si rischia di
-- mostrarle a partita gia cominciata.
--
-- Il guardiano gira ogni minuto ed e gia sveglio nella finestra della gara:
-- scrive qui, e l'app legge in tempo reale come fa gia per il punteggio.
-- Un minuto invece di venti, e nessun deploy.

alter table stato_partita
  -- l'id opaco della partita sul sito della Lega: si trova una volta e resta
  add column if not exists legapro_id text,
  -- {"casa": {...}, "ospiti": {...}} come lo scrive il parser
  add column if not exists formazione jsonb,
  -- quando si e guardato l'ultima volta, per non insistere ogni minuto
  add column if not exists formazione_vista_il timestamptz;
