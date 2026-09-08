-- Ruoli, blocco fra utenti, segnalazioni e sospensione.
--
-- PERCHE ADESSO
--
-- Le condizioni d'uso dell'app promettono gia che "ogni contenuto si puo
-- segnalare". Non era vero: la tabella `segnalazioni` esisteva dal primo giorno
-- ma non c'era nessun modo di scriverci dentro, e nessun modo di bloccare
-- qualcuno. Oltre alla promessa mancata, e la richiesta esplicita di Apple
-- (linea guida 1.2) e di Google per qualunque app con contenuti scritti dagli
-- utenti: filtro, segnalazione, blocco. Il filtro c'era. Gli altri due no.
--
-- LA COSA DELICATA: L'ESCALATION DI PRIVILEGIO
--
-- `profiles` ha gia una policy che lascia a ognuno modificare il proprio
-- profilo. Aggiungere una colonna `ruolo` senza altro vorrebbe dire che
-- chiunque puo scriversi `admin` da solo con una chiamata all'API — la chiave
-- anonima sta dentro l'app ed e per definizione nota a tutti. Il ruolo e la
-- sospensione sono quindi protetti da un trigger che rifiuta la modifica se non
-- arriva dal service role o da un admin gia tale.
--
-- I RUOLI
--
--   utente      chi si registra. Scrive le proprie cose, segnala, blocca.
--   moderatore  in piu: vede le segnalazioni e nasconde i contenuti.
--   admin       in piu: assegna i ruoli e sospende.
--
-- Nessuno diventa moderatore o admin dall'app. Si assegnano a mano dal pannello
-- Supabase, ed e voluto.

-- ------------------------------------------------------------------ ruoli

alter table profiles add column if not exists ruolo text not null default 'utente';
alter table profiles add column if not exists sospeso_fino timestamptz;

do $$ begin
  alter table profiles add constraint profiles_ruolo_valido
    check (ruolo in ('utente', 'moderatore', 'admin'));
exception when duplicate_object then null; end $$;

create index if not exists profiles_ruolo on profiles (ruolo) where ruolo <> 'utente';

/*
 * Il ruolo di chi sta chiamando.
 *
 * SECURITY DEFINER perche deve leggere `profiles` senza ripassare dalle
 * politiche della stessa tabella: una policy che interroga la tabella che sta
 * proteggendo va in ricorsione. `search_path` fissato perche una funzione
 * definer con il percorso libero e una porta aperta.
 */
create or replace function mio_ruolo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select ruolo from profiles where id = auth.uid()), 'anonimo');
$$;

create or replace function e_moderatore()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select ruolo in ('moderatore', 'admin') from profiles where id = auth.uid()), false);
$$;

create or replace function e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select ruolo = 'admin' from profiles where id = auth.uid()), false);
$$;

/** Sospeso adesso: gli si legge tutto, ma non scrive piu niente. */
create or replace function sono_sospeso()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select sospeso_fino > now() from profiles where id = auth.uid()), false);
$$;

/*
 * Il ruolo e la sospensione non si toccano da soli.
 *
 * Senza questo trigger la policy "ognuno modifica il proprio profilo" basterebbe
 * a farsi admin con una riga di codice. Il service role (l'ingest, le funzioni
 * server) passa: la sua sessione non ha auth.uid() ne il ruolo `authenticated`.
 */
create or replace function proteggi_ruolo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ruolo is distinct from old.ruolo or new.sospeso_fino is distinct from old.sospeso_fino then
    if auth.role() = 'authenticated' and not e_admin() then
      raise exception 'il ruolo e la sospensione li assegna un amministratore';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ruolo_protetto on profiles;
create trigger ruolo_protetto before update on profiles
  for each row execute function proteggi_ruolo();

-- un admin puo cambiare il profilo altrui: serve per assegnare ruoli e sospendere
drop policy if exists "un admin modifica qualsiasi profilo" on profiles;
create policy "un admin modifica qualsiasi profilo"
  on profiles for update using (e_admin());

-- ----------------------------------------------------------------- blocchi

/*
 * Chi non voglio piu leggere.
 *
 * Il filtro non sta nell'app ma nelle politiche di lettura piu sotto: un blocco
 * che vive solo nel telefono si aggira chiamando l'API a mano, e per Apple non
 * conta. Qui il contenuto di chi hai bloccato non ti viene proprio consegnato.
 *
 * E asimmetrico per scelta: bloccare qualcuno non gli dice niente e non gli
 * toglie niente. Serve a chi blocca, non a punire chi e bloccato.
 */
create table if not exists blocchi (
  utente    uuid not null references profiles on delete cascade,
  bloccato  uuid not null references profiles on delete cascade,
  creato_il timestamptz not null default now(),
  primary key (utente, bloccato),
  check (utente <> bloccato)
);

create index if not exists blocchi_utente on blocchi (utente);

alter table blocchi enable row level security;

drop policy if exists "ognuno vede i propri blocchi" on blocchi;
create policy "ognuno vede i propri blocchi"
  on blocchi for select using (auth.uid() = utente);

drop policy if exists "ognuno blocca per se" on blocchi;
create policy "ognuno blocca per se"
  on blocchi for insert with check (auth.uid() = utente);

drop policy if exists "ognuno sblocca chi ha bloccato" on blocchi;
create policy "ognuno sblocca chi ha bloccato"
  on blocchi for delete using (auth.uid() = utente);

/** Gli id che ho bloccato. Fuori dalle policy per non riscriverla ogni volta. */
create or replace function bloccati()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select bloccato from blocchi where utente = auth.uid();
$$;

-- ------------------------------------------------------------ segnalazioni

alter table segnalazioni add column if not exists stato text not null default 'aperta';
alter table segnalazioni add column if not exists gestita_da uuid references profiles on delete set null;
alter table segnalazioni add column if not exists nota_moderatore text;

do $$ begin
  alter table segnalazioni add constraint segnalazioni_stato_valido
    check (stato in ('aperta', 'accolta', 'respinta'));
exception when duplicate_object then null; end $$;

-- la chat dal vivo, le trasferte e i profili mancavano fra i bersagli possibili
alter table segnalazioni drop constraint if exists segnalazioni_tipo_check;
alter table segnalazioni add constraint segnalazioni_tipo_check
  check (tipo in ('discussione', 'risposta', 'messaggio', 'trasferta', 'profilo'));

create index if not exists segnalazioni_aperte on segnalazioni (creata_il desc) where stato = 'aperta';

-- chi modera le legge tutte e le chiude
drop policy if exists "chi modera legge le segnalazioni" on segnalazioni;
create policy "chi modera legge le segnalazioni"
  on segnalazioni for select using (e_moderatore());

drop policy if exists "chi modera chiude le segnalazioni" on segnalazioni;
create policy "chi modera chiude le segnalazioni"
  on segnalazioni for update using (e_moderatore());

-- --------------------------------------------- lettura filtrata dai blocchi

drop policy if exists "discussioni visibili se non nascoste" on discussioni;
create policy "discussioni visibili se non nascoste"
  on discussioni for select
  using (not nascosta and autore not in (select bloccati()));

drop policy if exists "risposte visibili" on risposte;
drop policy if exists "risposte visibili se non nascoste" on risposte;
create policy "risposte visibili se non nascoste"
  on risposte for select
  using (not nascosta and autore not in (select bloccati()));

-- il nome vecchio va tolto per esteso: le politiche si sommano con OR, e una
-- vecchia policy "using (not nascosto)" lasciata viva annullerebbe il blocco
drop policy if exists "la chat la legge chiunque" on messaggi_live;
drop policy if exists "messaggi visibili se non nascosti" on messaggi_live;
create policy "messaggi visibili se non nascosti"
  on messaggi_live for select
  using (not nascosto and utente not in (select bloccati()));

drop policy if exists "chi va in trasferta lo vedono tutti" on trasferte;
create policy "chi va in trasferta lo vedono tutti"
  on trasferte for select using (utente not in (select bloccati()));

-- ------------------------------------------------------------- moderazione

drop policy if exists "chi modera nasconde le discussioni" on discussioni;
create policy "chi modera nasconde le discussioni"
  on discussioni for update using (e_moderatore());

drop policy if exists "chi modera nasconde le risposte" on risposte;
create policy "chi modera nasconde le risposte"
  on risposte for update using (e_moderatore());

drop policy if exists "chi modera nasconde i messaggi" on messaggi_live;
create policy "chi modera nasconde i messaggi"
  on messaggi_live for update using (e_moderatore());

drop policy if exists "un admin cancella qualsiasi discussione" on discussioni;
create policy "un admin cancella qualsiasi discussione"
  on discussioni for delete using (e_admin());

drop policy if exists "un admin cancella qualsiasi risposta" on risposte;
create policy "un admin cancella qualsiasi risposta"
  on risposte for delete using (e_admin());

drop policy if exists "un admin cancella qualsiasi trasferta" on trasferte;
create policy "un admin cancella qualsiasi trasferta"
  on trasferte for delete using (e_admin());

-- --------------------------------------------------------- chi e sospeso tace

/*
 * Apple chiede di poter cacciare chi abusa, non solo di nascondere il singolo
 * messaggio. La sospensione non cancella niente di quel che ha gia scritto: gli
 * toglie la parola fino alla data, e basta.
 *
 * Sta in un trigger e non in una policy perche il messaggio d'errore arriva
 * all'app: una policy che rifiuta silenziosamente farebbe sembrare l'app rotta.
 */
create or replace function blocca_sospesi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if sono_sospeso() then
    raise exception 'account sospeso: non puoi pubblicare fino alla scadenza';
  end if;
  return new;
end;
$$;

drop trigger if exists sospesi_zitti on discussioni;
create trigger sospesi_zitti before insert on discussioni
  for each row execute function blocca_sospesi();

drop trigger if exists sospesi_zitti on risposte;
create trigger sospesi_zitti before insert on risposte
  for each row execute function blocca_sospesi();

drop trigger if exists sospesi_zitti on messaggi_live;
create trigger sospesi_zitti before insert on messaggi_live
  for each row execute function blocca_sospesi();

drop trigger if exists sospesi_zitti on trasferte;
create trigger sospesi_zitti before insert on trasferte
  for each row execute function blocca_sospesi();
