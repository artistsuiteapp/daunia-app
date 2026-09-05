-- Notifiche push per la PWA.
--
-- Perche web push e non le notifiche native: con un Apple ID gratuito
-- l'entitlement APNs non viene concesso, quindi un'app installata con AltStore
-- e un account gratuito non puo ricevere notifiche. La PWA aggiunta alla
-- schermata Home invece le riceve da iOS 16.4, senza account Apple e senza
-- costi. Su Android funziona anche senza aggiungerla alla Home.

-- Un'iscrizione e la coppia (endpoint, chiavi) che il browser rilascia al sito.
-- L'endpoint e una URL lunga e non indovinabile: e lui stesso la credenziale,
-- come funziona il protocollo Web Push. Per questo un ospite senza account puo
-- iscriversi, e per questo si puo cancellare conoscendo solo l'endpoint.
create table if not exists push_iscrizioni (
  endpoint    text primary key,
  utente      uuid references profiles on delete cascade,
  p256dh      text not null,
  auth        text not null,
  -- quali notifiche vuole: formazioni, inizio, gol, espulsione, fine
  preferenze  jsonb not null default '{"formazioni":true,"inizio":true,"gol":true,"espulsione":true,"fine":true}'::jsonb,
  creato_il   timestamptz not null default now(),
  visto_il    timestamptz not null default now()
);

create index if not exists push_iscrizioni_utente on push_iscrizioni (utente);

alter table push_iscrizioni enable row level security;

-- Iscriversi si puo anche senza account: le notifiche dei gol non sono un
-- premio per chi si registra, sono il motivo per cui uno torna. Chiedere
-- l'account qui allontanerebbe proprio le persone che vogliamo far tornare.
drop policy if exists "chiunque puo iscriversi" on push_iscrizioni;
create policy "chiunque puo iscriversi"
  on push_iscrizioni for insert
  with check (utente is null or auth.uid() = utente);

-- Aggiornare e cancellare richiede di conoscere l'endpoint, che il browser da
-- solo al proprio sito. Chi ha un account puo agire anche sulle proprie righe.
drop policy if exists "si modifica la propria iscrizione" on push_iscrizioni;
create policy "si modifica la propria iscrizione"
  on push_iscrizioni for update
  using (utente is null or auth.uid() = utente)
  with check (utente is null or auth.uid() = utente);

drop policy if exists "si cancella la propria iscrizione" on push_iscrizioni;
create policy "si cancella la propria iscrizione"
  on push_iscrizioni for delete
  using (utente is null or auth.uid() = utente);

-- Nessuno legge le iscrizioni dal client: le chiavi di cifratura di un altro
-- telefono non servono a niente a nessuno tranne che a chi vuole fare danni.
-- Solo il service role, dentro la Edge Function, le vede.
drop policy if exists "le iscrizioni non si leggono dal client" on push_iscrizioni;

-- La memoria del guardiano: cosa sapeva dell'ultima volta che ha guardato.
-- Senza questa riga non puo accorgersi che il punteggio e cambiato.
create table if not exists stato_partita (
  partita            text primary key,
  event_id           bigint,
  fixture_id         bigint,
  casa               smallint,
  ospiti             smallint,
  stato              text,
  formazioni_mandate boolean not null default false,
  inizio_mandato     boolean not null default false,
  fine_mandata       boolean not null default false,
  aggiornato_il      timestamptz not null default now()
);

alter table stato_partita enable row level security;

-- Il punteggio dal vivo lo puo leggere chiunque: e un fatto pubblico, e
-- leggerlo da qui costa meno che interrogare la fonte da ogni telefono.
drop policy if exists "il punteggio lo legge chiunque" on stato_partita;
create policy "il punteggio lo legge chiunque"
  on stato_partita for select using (true);
