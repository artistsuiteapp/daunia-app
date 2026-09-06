-- Da quando le due fonti non vanno d'accordo.
--
-- Serve a non annunciare due volte lo stesso gol. Quando il tabellone si muove
-- e API-Football non ne sa ancora niente, non si spara subito la notifica: gli
-- si danno due minuti per allinearsi. Se li usa, il gol lo annuncia lui col
-- nome del marcatore; se non li usa, lo annuncia il tabellone senza nome.
--
-- Senza questa colonna le due strade partirebbero insieme e il telefono
-- suonerebbe due volte per un gol solo.

alter table stato_partita
  add column if not exists disaccordo_dal timestamptz;
