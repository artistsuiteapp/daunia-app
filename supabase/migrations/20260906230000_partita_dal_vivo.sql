-- La partita dal vivo, letta dall'app invece che dalla fonte.
--
-- Il telefono interrogava TheSportsDB per conto suo con `lookupevent.php`, che
-- e la scheda dell'evento e arriva tardi: durante Foggia-Cerignola diceva "HT"
-- mentre la partita era al 48esimo. La lista del dal vivo, quella giusta, pesa
-- una sessantina di chilobyte e sul telefono ogni quarantacinque secondi non si
-- puo scaricare.
--
-- Quindi la scarica il guardiano, una volta al minuto sul server, e l'app legge
-- questa riga. Con Realtime il punteggio arriva da solo, senza interrogare
-- niente: meno traffico sul telefono e un dato piu fresco di prima.

-- I gol con il minuto vero, cosi la scheda ha una cronologia anche quando
-- API-Football non da i marcatori: [{"minuto":"48","casa":0,"ospiti":2,"nostro":false}]
alter table stato_partita
  add column if not exists gol jsonb not null default '[]'::jsonb;

-- Realtime: senza questo l'app dovrebbe interrogare a intervalli, che e
-- esattamente quello che stiamo togliendo.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'stato_partita'
  ) then
    alter publication supabase_realtime add table stato_partita;
  end if;
end $$;

-- La riga la scrive solo il guardiano, che ha il service role: per tutti gli
-- altri e sola lettura, e la policy di lettura c'e gia dalla prima migrazione.
