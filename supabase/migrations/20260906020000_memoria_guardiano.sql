-- Quello che il guardiano deve ricordarsi fra un giro e l'altro.
--
-- Senza questo, a ogni minuto rimanderebbe la notifica dello stesso gol. La
-- regola e semplice: si annota cosa e gia stato detto, e non lo si ridice.

alter table stato_partita
  add column if not exists kickoff          timestamptz,
  add column if not exists etichetta        text,
  -- firme degli eventi gia notificati: "gol-52-Luciani", "rosso-71-Berra"
  add column if not exists eventi_detti     jsonb not null default '[]'::jsonb,
  add column if not exists eventi_letti_il  timestamptz,
  add column if not exists formazioni_viste_il timestamptz;
