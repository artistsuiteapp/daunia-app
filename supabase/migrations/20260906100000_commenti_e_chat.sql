-- Modifica dei commenti, e la chat della partita.
--
-- LE RISPOSTE SI POTEVANO CANCELLARE MA NON CORREGGERE
--
-- C'era la policy di cancellazione e non quella di modifica. Uno che sbagliava
-- una parola poteva solo buttare via il messaggio e riscriverlo, perdendo le
-- risposte che aveva gia ricevuto. Non era una scelta: era una dimenticanza.

alter table risposte add column if not exists modificata_il timestamptz;
alter table discussioni add column if not exists modificata_il timestamptz;

drop policy if exists "ognuno modifica le proprie risposte" on risposte;
create policy "ognuno modifica le proprie risposte"
  on risposte for update
  using (auth.uid() = autore) with check (auth.uid() = autore);

-- Il filtro vale anche sulle modifiche, non solo su quello che si scrive la
-- prima volta: altrimenti bastava pubblicare pulito e correggere dopo.
drop trigger if exists niente_offese on risposte;
create trigger niente_offese before insert or update on risposte
  for each row execute function blocca_offese();

drop trigger if exists niente_offese on discussioni;
create trigger niente_offese before insert or update on discussioni
  for each row execute function blocca_offese();

-- ---------------------------------------------------------------------------
-- LA CHAT DELLA PARTITA
--
-- Esiste solo mentre si gioca e si chiude da sola. Una stanza vuota il martedi
-- fa piu danno che bene: e la prova che non c'e nessuno.
--
-- I messaggi sono corti apposta. Durante una partita si scrive di getto, e un
-- limite basso tiene la stanza leggibile invece di riempirla di muri di testo.

create table if not exists messaggi_live (
  id        uuid primary key default gen_random_uuid(),
  partita   text not null,
  utente    uuid not null references profiles on delete cascade,
  testo     text not null check (char_length(trim(testo)) between 1 and 300),
  creato_il timestamptz not null default now(),
  nascosto  boolean not null default false
);

create index if not exists messaggi_live_partita on messaggi_live (partita, creato_il desc);

alter table messaggi_live enable row level security;

-- Legge chiunque, ospiti compresi: guardare la partita commentata da altri e
-- il motivo per cui uno poi si iscrive.
drop policy if exists "la chat la legge chiunque" on messaggi_live;
create policy "la chat la legge chiunque"
  on messaggi_live for select using (not nascosto);

drop policy if exists "scrive solo chi ha fatto accesso" on messaggi_live;
create policy "scrive solo chi ha fatto accesso"
  on messaggi_live for insert
  with check (auth.uid() = utente);

drop policy if exists "ognuno cancella i propri messaggi" on messaggi_live;
create policy "ognuno cancella i propri messaggi"
  on messaggi_live for delete using (auth.uid() = utente);

-- Niente modifica: in una chat dal vivo correggere un messaggio a cui hanno
-- gia risposto cambia il senso della conversazione. Si cancella e si riscrive.

drop trigger if exists niente_offese on messaggi_live;
create trigger niente_offese before insert on messaggi_live
  for each row execute function blocca_offese();

-- Realtime: i messaggi nuovi devono arrivare da soli, senza ricaricare.
alter publication supabase_realtime add table messaggi_live;
