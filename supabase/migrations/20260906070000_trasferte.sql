-- Trasferte: chi ci va, da dove, e soprattutto se ci puo andare.
--
-- IL PUNTO CHE FA ESISTERE QUESTA SEZIONE
--
-- Il divieto per le partite a rischio colpisce i RESIDENTI nella provincia
-- della squadra ospite, salvo Tessera del tifoso. Non tutti, e non sempre.
-- Un foggiano che vive a Bologna quasi mai e toccato dal divieto: puo comprare,
-- spesso anche fuori dal settore ospiti. Ma legge "trasferta vietata" sui
-- giornali e rinuncia.
--
-- La provincia di Foggia ha il peggior saldo migratorio interno d'Italia e
-- 69.689 iscritti all'AIRE. Quelli che in trasferta ci possono andare davvero
-- sono proprio loro, e non si conoscono fra loro.

create table if not exists divieti (
  partita       text primary key,
  stato         text not null default 'non-confermato'
                check (stato in ('aperta', 'vietata-residenti', 'ospiti-chiuso', 'non-confermato')),
  fonte_nome    text,
  fonte_url     text,
  nota          text,
  confermato_il timestamptz,
  aggiornato_il timestamptz not null default now()
);

alter table divieti enable row level security;

-- Lo legge chiunque, ospiti compresi: e l'informazione per cui la sezione
-- esiste, e chiederla dietro un account non avrebbe senso.
drop policy if exists "i divieti li legge chiunque" on divieti;
create policy "i divieti li legge chiunque" on divieti for select using (true);

-- Nessuna policy di scrittura: si scrive solo dal service role, dopo che una
-- persona ha confermato. Un divieto sbagliato fa perdere un treno a qualcuno.

create table if not exists trasferte (
  partita    text not null,
  utente     uuid not null references profiles on delete cascade,
  citta      text not null check (length(trim(citta)) between 2 and 60),
  mezzo      text not null check (mezzo in ('macchina', 'treno', 'pullman', 'aereo', 'ci-sono-gia')),
  posti      smallint not null default 0 check (posti between 0 and 8),
  nota       text check (nota is null or length(nota) <= 280),
  creato_il  timestamptz not null default now(),
  primary key (partita, utente)
);

create index if not exists trasferte_partita on trasferte (partita);

alter table trasferte enable row level security;

-- Chi ci va lo vedono tutti: e il senso della cosa. Da dove parte anche, perche
-- e cosi che due di Bologna si accorgono l'uno dell'altro. Ma NON i contatti:
-- non esiste una colonna per il telefono, e non deve esistere. Ci si scrive nel
-- filo della trasferta, dove c'e moderazione e si vede quel che succede.
drop policy if exists "chi va in trasferta lo vedono tutti" on trasferte;
create policy "chi va in trasferta lo vedono tutti" on trasferte for select using (true);

drop policy if exists "ognuno dichiara per se" on trasferte;
create policy "ognuno dichiara per se" on trasferte for all
  using (auth.uid() = utente) with check (auth.uid() = utente);

-- La nota passa dallo stesso filtro di tutto il resto.
drop trigger if exists niente_offese on trasferte;
create trigger niente_offese before insert or update on trasferte
  for each row execute function blocca_offese();
