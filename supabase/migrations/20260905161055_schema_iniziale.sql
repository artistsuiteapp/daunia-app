-- Il Tifo della Daunia — schema del database
--
-- Ogni tabella sostituisce un pezzo che oggi vive nella memoria del browser.
-- L'app non cambia: lib/community.ts e lib/fanplay.ts espongono gia le funzioni
-- che le schermate chiamano, e passare a Supabase vuol dire riscrivere quei due
-- file soltanto.
--
-- La regola che tiene in piedi tutto e la sicurezza per riga (RLS): senza,
-- chiunque abbia la chiave pubblica dell'app potrebbe leggere e scrivere
-- qualsiasi riga. La chiave anon e fatta per stare dentro l'app, ed e proprio
-- l'RLS a renderla innocua.

-- ---------------------------------------------------------------- profili

create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  nome        text not null check (char_length(nome) between 2 and 40),
  creato_il   timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profili leggibili da tutti"
  on profiles for select using (true);

create policy "ognuno modifica il proprio profilo"
  on profiles for update using (auth.uid() = id);

create policy "ognuno crea il proprio profilo"
  on profiles for insert with check (auth.uid() = id);

-- ------------------------------------------------------------ discussioni

create table if not exists discussioni (
  id           uuid primary key default gen_random_uuid(),
  autore       uuid not null references profiles on delete cascade,
  titolo       text not null check (char_length(titolo) between 4 and 120),
  testo        text not null check (char_length(testo) between 10 and 8000),
  argomento    text not null check (argomento in
                 ('Partita','Formazione','Mercato','Trasferte',
                  'Zaccheria','Giovanili','Memoria','Fuori tema')),
  creata_il    timestamptz not null default now(),
  -- si aggiorna a ogni risposta: serve a ordinare per attivita senza join
  attiva_il    timestamptz not null default now(),
  nascosta     boolean not null default false
);

create index if not exists discussioni_attive on discussioni (attiva_il desc)
  where not nascosta;

alter table discussioni enable row level security;

create policy "discussioni visibili se non nascoste"
  on discussioni for select using (not nascosta);

create policy "scrive chi ha fatto accesso"
  on discussioni for insert with check (auth.uid() = autore);

create policy "ognuno modifica le proprie"
  on discussioni for update using (auth.uid() = autore);

create policy "ognuno cancella le proprie"
  on discussioni for delete using (auth.uid() = autore);

-- --------------------------------------------------------------- risposte

create table if not exists risposte (
  id            uuid primary key default gen_random_uuid(),
  discussione   uuid not null references discussioni on delete cascade,
  autore        uuid not null references profiles on delete cascade,
  testo         text not null check (char_length(testo) between 1 and 4000),
  creata_il     timestamptz not null default now(),
  nascosta      boolean not null default false
);

create index if not exists risposte_per_discussione
  on risposte (discussione, creata_il);

alter table risposte enable row level security;

create policy "risposte visibili se non nascoste"
  on risposte for select using (not nascosta);

create policy "risponde chi ha fatto accesso"
  on risposte for insert with check (auth.uid() = autore);

create policy "ognuno cancella le proprie risposte"
  on risposte for delete using (auth.uid() = autore);

-- una risposta rimette in cima la discussione
create or replace function tocca_discussione() returns trigger
language plpgsql security definer as $$
begin
  update discussioni set attiva_il = now() where id = new.discussione;
  return new;
end $$;

drop trigger if exists risposta_tocca_discussione on risposte;
create trigger risposta_tocca_discussione
  after insert on risposte
  for each row execute function tocca_discussione();

-- ---------------------------------------------------------------- presenze

create table if not exists presenze (
  utente     uuid not null references profiles on delete cascade,
  partita    text not null,
  settore    text not null,
  creata_il  timestamptz not null default now(),
  primary key (utente, partita)
);

alter table presenze enable row level security;

create policy "presenze leggibili da tutti"
  on presenze for select using (true);

create policy "ognuno dichiara la propria presenza"
  on presenze for all using (auth.uid() = utente) with check (auth.uid() = utente);

-- il conteggio per settore, senza esporre chi ci va
create or replace view presenze_per_settore as
  select partita, settore, count(*)::int as quanti
  from presenze group by partita, settore;

-- ----------------------------------------------------------------- pagelle

create table if not exists voti (
  utente     uuid not null references profiles on delete cascade,
  partita    text not null,
  giocatore  text not null,
  voto       smallint not null check (voto between 1 and 10),
  creato_il  timestamptz not null default now(),
  primary key (utente, partita, giocatore)
);

alter table voti enable row level security;

create policy "ognuno vede e cambia solo i propri voti"
  on voti for all using (auth.uid() = utente) with check (auth.uid() = utente);

-- le medie sono pubbliche, i singoli voti no
create or replace view medie_voti as
  select partita, giocatore, round(avg(voto)::numeric, 1) as media, count(*)::int as quanti
  from voti group by partita, giocatore;

-- -------------------------------------------------------------- pronostici

create table if not exists pronostici (
  utente     uuid not null references profiles on delete cascade,
  partita    text not null,
  casa       smallint not null check (casa between 0 and 20),
  ospiti     smallint not null check (ospiti between 0 and 20),
  creato_il  timestamptz not null default now(),
  primary key (utente, partita)
);

alter table pronostici enable row level security;

-- Un pronostico si legge solo dopo che la partita e finita: altrimenti basta
-- guardare quelli degli altri per copiare, e la classifica non vale niente.
create policy "i propri pronostici sempre, quelli altrui a partita finita"
  on pronostici for select
  using (auth.uid() = utente or exists (
    select 1 from partite_chiuse p where p.partita = pronostici.partita
  ));

create policy "ognuno scrive il proprio pronostico"
  on pronostici for all using (auth.uid() = utente) with check (auth.uid() = utente);

-- elenco delle partite gia giocate, riempito dall'ingest
create table if not exists partite_chiuse (
  partita    text primary key,
  casa       smallint not null,
  ospiti     smallint not null,
  chiusa_il  timestamptz not null default now()
);

alter table partite_chiuse enable row level security;
create policy "risultati leggibili da tutti" on partite_chiuse for select using (true);

-- ----------------------------------------------------------- segnalazioni

-- Obbligo dal regolamento europeo sui servizi digitali: chi ospita contenuti di
-- altri deve avere un modo per ricevere segnalazioni e intervenire.
create table if not exists segnalazioni (
  id          uuid primary key default gen_random_uuid(),
  segnalante  uuid references profiles on delete set null,
  tipo        text not null check (tipo in ('discussione','risposta')),
  bersaglio   uuid not null,
  motivo      text not null check (char_length(motivo) between 3 and 500),
  creata_il   timestamptz not null default now(),
  gestita_il  timestamptz
);

alter table segnalazioni enable row level security;

create policy "chiunque abbia fatto accesso puo segnalare"
  on segnalazioni for insert with check (auth.uid() = segnalante);

create policy "ognuno rivede le proprie segnalazioni"
  on segnalazioni for select using (auth.uid() = segnalante);

-- -------------------------------------------------------------- notifiche

create table if not exists dispositivi (
  utente     uuid not null references profiles on delete cascade,
  token      text primary key,
  piattaforma text not null check (piattaforma in ('ios','android','web')),
  gol        boolean not null default true,
  prepartita boolean not null default true,
  curva      boolean not null default false,
  creato_il  timestamptz not null default now()
);

alter table dispositivi enable row level security;

create policy "ognuno gestisce i propri dispositivi"
  on dispositivi for all using (auth.uid() = utente) with check (auth.uid() = utente);
