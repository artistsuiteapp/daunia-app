-- Nuovi argomenti per la Curva.
--
-- I cinque aggiunti non sono riempitivi: sono le cose di cui i tifosi del
-- Foggia parlano e che finivano tutte in "Fuori tema".
--
--   Societa    penalizzazioni, ricorsi, iscrizione al campionato. Per una
--              squadra che negli ultimi anni ha rischiato di non iscriversi
--              e il pensiero fisso, non una curiosita
--   Arbitri    si discute ogni domenica, sempre
--   Tifoseria  cori, coreografie, diffide, la curva come soggetto
--   Biglietti  prezzi, settori esauriti, abbonamenti
--   Serie C    le altre del girone, la classifica, i regolamenti

alter table discussioni drop constraint if exists discussioni_argomento_check;

alter table discussioni add constraint discussioni_argomento_check
  check (argomento = any (array[
    'Partita', 'Formazione', 'Mercato', 'Società', 'Arbitri',
    'Trasferte', 'Biglietti', 'Tifoseria', 'Zaccheria', 'Serie C',
    'Giovanili', 'Memoria', 'Fuori tema'
  ]));
