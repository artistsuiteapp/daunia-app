-- Quando e finita davvero.
--
-- La chat della partita deve chiudere venti minuti dopo il triplice fischio,
-- non a un orario calcolato dal calcio d'inizio: fra recuperi e ritardi la
-- differenza fra i due e di dieci minuti buoni, e sono proprio i dieci minuti
-- in cui la gente commenta.

alter table stato_partita
  add column if not exists finita_il timestamptz;
