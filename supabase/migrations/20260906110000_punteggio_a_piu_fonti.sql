-- Il punteggio adesso ha piu di una fonte, e il guardiano deve ricordarsene.
--
-- `casa` e `ospiti` restano quello che dice TheSportsDB, e servono a una cosa
-- sola: accorgersi che il tabellone si e mosso. Se ci mettessimo dentro il
-- punteggio contato dagli eventi di API-Football, il confronto del giro dopo
-- sarebbe fra due fonti diverse e risulterebbe cambiato ogni minuto, bruciando
-- la quota giornaliera in un pomeriggio.
--
-- Il punteggio buono, quello confermato da due fonti, sta nelle colonne nuove.

alter table stato_partita
  -- punteggio contato dagli eventi di API-Football
  add column if not exists casa_af   smallint,
  add column if not exists ospiti_af smallint,
  -- quante volte si e gia pagata la terza fonte per rompere una parita:
  -- senza tetto una partita senza copertura la chiamerebbe ogni minuto
  add column if not exists pareri_chiesti smallint not null default 0;
