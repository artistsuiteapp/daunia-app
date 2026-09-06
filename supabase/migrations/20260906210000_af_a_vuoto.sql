-- Quante volte di fila API-Football ha risposto a vuoto per questa partita.
--
-- Stasera l'account e finito sospeso a meta partita. Il conto torna: il
-- guardiano rileggeva gli eventi ogni tre minuti per tutta la finestra, piu le
-- formazioni ogni dieci prima del fischio, piu l'ingest. Sommati stanno sulle
-- cento chiamate del piano gratuito, e la partita non aveva eventi da dare:
-- erano tutte chiamate spese per niente.
--
-- Con questo contatore il guardiano si arrende dopo tre risposte inutili e
-- smette di chiedere per quella partita. Il tabellone di TheSportsDB continua
-- a coprire i gol, e la quota resta per le partite dove API-Football serve.

alter table stato_partita
  add column if not exists af_a_vuoto smallint not null default 0;
