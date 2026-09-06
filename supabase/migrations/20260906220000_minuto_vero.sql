-- Il minuto di gioco, quello vero.
--
-- Arriva da `livescore.php` di TheSportsDB, campo `strProgress`: "48", e col
-- recupero "45+5". La scheda evento che usavamo prima quel campo non ce l'ha,
-- e infatti il minuto lo stimavamo dall'orario.
--
-- E testo e non un numero apposta: "45+5" non e un intero, e sommarlo a 45
-- perderebbe l'unica informazione interessante.
--
-- Sta qui perche la risposta del dal vivo pesa una sessantina di chilobyte:
-- il guardiano la scarica una volta al minuto sul server, l'app legge questa
-- riga e non deve scaricare niente.

alter table stato_partita
  add column if not exists minuto text;
