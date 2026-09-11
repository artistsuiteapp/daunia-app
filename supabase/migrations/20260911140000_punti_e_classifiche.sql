-- Punti, livelli, badge e classifiche.
--
-- LA REGOLA CHE TIENE IN PIEDI TUTTO: I PUNTI NON SI SOMMANO, SI REGISTRANO
--
-- Un contatore `punti` sul profilo sembra la cosa ovvia e si rompe al primo
-- errore: il guardiano rielabora una partita, il trigger riparte, e uno si
-- ritrova il doppio dei punti senza che nessuno sappia dire da dove vengono.
-- Qui ogni punto e una riga con scritto PERCHE, e la coppia (azione, chiave) e
-- unica: rieseguire la stessa assegnazione non fa niente. Il totale e una
-- somma, non un numero custodito.
--
-- E anche l'unico modo di rispondere a "perche ho 340 punti": si aprono le
-- righe e si legge.
--
-- I PUNTI NON LI SCRIVE MAI IL CLIENT
--
-- Nessuna politica di inserimento su punti_movimenti. Si entra solo da
-- funzioni security definer chiamate dai trigger o da RPC che controllano le
-- condizioni. Con la chiave anonima in mano a chiunque, una tabella di punti
-- scrivibile dal client e una classifica finta il primo giorno.

/* ------------------------------------------------------------- le tariffe */

-- In tabella e non nel codice: cambiare quanto vale un quiz non deve
-- richiedere una migrazione. I punti gia assegnati non si toccano, restano
-- quelli del giorno in cui sono stati dati.
create table if not exists punti_tariffe (
  azione text primary key,
  punti  int not null check (punti between 0 and 1000),
  nome   text not null
);

alter table punti_tariffe enable row level security;

drop policy if exists "le tariffe le legge chiunque" on punti_tariffe;
create policy "le tariffe le legge chiunque"
  on punti_tariffe for select using (true);

insert into punti_tariffe (azione, punti, nome) values
  ('pronostico',  10,  'Pronostico fatto'),
  ('esito',       50,  'Esito indovinato'),
  ('risultato',  100,  'Risultato esatto'),
  ('quiz',        20,  'Risposta giusta al quiz'),
  ('mvp',          5,  'Voto al migliore in campo'),
  ('pagelle',      5,  'Pagelle date'),
  ('sondaggio',    5,  'Sondaggio votato'),
  ('condivisione', 5,  'App condivisa')
on conflict (azione) do nothing;

/* ------------------------------------------------------------- il registro */

create table if not exists punti_movimenti (
  id        bigserial primary key,
  utente    uuid not null references profiles on delete cascade,
  azione    text not null references punti_tariffe (azione),
  -- a cosa si riferisce: la partita, la domanda del quiz, il giorno della
  -- condivisione. Insieme all'azione e la chiave che impedisce il doppio.
  chiave    text not null,
  punti     int not null check (punti >= 0),
  creato_il timestamptz not null default now(),
  unique (utente, azione, chiave)
);

create index if not exists punti_per_utente on punti_movimenti (utente, creato_il desc);
create index if not exists punti_per_data on punti_movimenti (creato_il desc);

alter table punti_movimenti enable row level security;

-- I propri movimenti si leggono: "perche ho questi punti" e una domanda
-- legittima. Quelli altrui no, le classifiche passano dalle funzioni.
drop policy if exists "ognuno legge i propri movimenti" on punti_movimenti;
create policy "ognuno legge i propri movimenti"
  on punti_movimenti for select using (auth.uid() = utente);

/*
 * L'unica porta d'ingresso ai punti.
 *
 * security definer perche i trigger e le RPC girano per conto di chi usa
 * l'app, che su questa tabella non puo scrivere. `on conflict do nothing` e
 * l'idempotenza: la stessa azione sulla stessa chiave non paga due volte,
 * qualunque cosa succeda a monte.
 */
create or replace function assegna_punti(chi uuid, che_azione text, la_chiave text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  quanti int;
begin
  if chi is null or la_chiave is null or la_chiave = '' then return 0; end if;

  select punti into quanti from punti_tariffe where azione = che_azione;
  if quanti is null then return 0; end if;

  insert into punti_movimenti (utente, azione, chiave, punti)
  values (chi, che_azione, la_chiave, quanti)
  on conflict (utente, azione, chiave) do nothing;

  if not found then return 0; end if;
  return quanti;
end $$;

revoke execute on function assegna_punti(uuid, text, text) from public, anon, authenticated;

/* ---------------------------------------------------- quando si guadagnano */

create or replace function punti_per_pronostico()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform assegna_punti(new.utente, 'pronostico', new.partita);
  return new;
end $$;

drop trigger if exists punti_pronostico on pronostici;
create trigger punti_pronostico after insert on pronostici
  for each row execute function punti_per_pronostico();

create or replace function punti_per_mvp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform assegna_punti(new.utente, 'mvp', new.partita);
  return new;
end $$;

drop trigger if exists punti_mvp on mvp_voti;
create trigger punti_mvp after insert on mvp_voti
  for each row execute function punti_per_mvp();

-- Le pagelle si pagano una volta per partita, non una per giocatore: la chiave
-- e la partita. Chi vota undici giocatori prende cinque punti, non cinquanta.
create or replace function punti_per_pagelle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform assegna_punti(new.utente, 'pagelle', new.partita);
  return new;
end $$;

drop trigger if exists punti_pagelle on voti;
create trigger punti_pagelle after insert on voti
  for each row execute function punti_per_pagelle();

/* --------------------------------------------- la partita finisce e si paga */

/*
 * La regola del pronostico, uguale a quella nell'app.
 *
 * Cento punti il risultato esatto, cinquanta l'esito. L'esito comprende il
 * pareggio: chi dice 1-1 e vede finire 2-2 ha indovinato come e andata.
 *
 * I due premi non si sommano: chi azzecca il risultato prende cento, non
 * centocinquanta. Sono due gradini dello stesso premio.
 */
create or replace function esito_di(casa int, ospiti int)
returns int
language sql
immutable
as $$
  select case when casa = ospiti then 0 when casa > ospiti then 1 else -1 end;
$$;

/*
 * Chiude una partita e paga i pronostici.
 *
 * Si puo chiamare quante volte si vuole: partite_chiuse ha la partita come
 * chiave primaria e i punti passano da assegna_punti, che non paga due volte.
 * Serve, perche il guardiano puo riscrivere la stessa riga piu di una volta.
 */
create or replace function chiudi_partita(la_partita text, gol_casa int, gol_ospiti int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  pagati int := 0;
begin
  insert into partite_chiuse (partita, casa, ospiti)
  values (la_partita, gol_casa, gol_ospiti)
  on conflict (partita) do nothing;

  for r in select utente, casa, ospiti from pronostici where partita = la_partita loop
    if r.casa = gol_casa and r.ospiti = gol_ospiti then
      pagati := pagati + assegna_punti(r.utente, 'risultato', la_partita);
    elsif esito_di(r.casa, r.ospiti) = esito_di(gol_casa, gol_ospiti) then
      pagati := pagati + assegna_punti(r.utente, 'esito', la_partita);
    end if;
  end loop;

  return pagati;
end $$;

revoke execute on function chiudi_partita(text, int, int) from public, anon, authenticated;

/*
 * Il momento in cui si chiude e quando il guardiano scrive finita_il.
 *
 * Prima partite_chiuse non la riempiva nessuno: la tabella c'era, la politica
 * di lettura dei pronostici altrui la interrogava, e restava vuota per sempre.
 * Quindi i pronostici degli altri non si vedevano mai e la classifica non
 * partiva. Adesso il segnale di fine partita fa le due cose insieme.
 */
create or replace function chiudi_al_triplice_fischio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.finita_il is null then return new; end if;
  if tg_op = 'UPDATE' and old.finita_il is not null then return new; end if;
  if new.casa is null or new.ospiti is null then return new; end if;

  perform chiudi_partita(new.partita, new.casa, new.ospiti);
  return new;
end $$;

drop trigger if exists chiudi_partita_finita on stato_partita;
create trigger chiudi_partita_finita after insert or update of finita_il on stato_partita
  for each row execute function chiudi_al_triplice_fischio();

/* ----------------------------------------------------------- la condivisione */

/*
 * Condividere paga una volta al giorno.
 *
 * La chiave e la data, quindi il tetto e il vincolo di unicita: non serve un
 * contatore e non si puo aggirare premendo piu in fretta. Non si verifica che
 * la condivisione sia avvenuta davvero -- non si puo -- quindi il premio resta
 * piccolo apposta.
 */
create or replace function punti_condivisione()
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return 0; end if;
  return assegna_punti(auth.uid(), 'condivisione', to_char(now() at time zone 'Europe/Rome', 'YYYY-MM-DD'));
end $$;

/* --------------------------------------------------------------- i periodi */

/*
 * La stagione comincia a luglio.
 *
 * Con l'anno solare la classifica stagionale si azzererebbe a gennaio, a
 * campionato in corso, che e il momento peggiore possibile.
 */
create or replace function stagione_di(quando timestamptz)
returns text
language sql
immutable
as $$
  select case
    when extract(month from (quando at time zone 'Europe/Rome')) >= 7
      then to_char(quando at time zone 'Europe/Rome', 'YYYY') || '-' ||
           to_char((quando at time zone 'Europe/Rome') + interval '1 year', 'YY')
    else to_char((quando at time zone 'Europe/Rome') - interval '1 year', 'YYYY') || '-' ||
         to_char(quando at time zone 'Europe/Rome', 'YY')
  end;
$$;

/** "2026-W37" — la settimana ISO, che comincia di lunedi. */
create or replace function settimana_di(quando timestamptz)
returns text
language sql
immutable
as $$
  select to_char(quando at time zone 'Europe/Rome', 'IYYY-"W"IW');
$$;

create or replace function mese_di(quando timestamptz)
returns text
language sql
immutable
as $$
  select to_char(quando at time zone 'Europe/Rome', 'YYYY-MM');
$$;

/** Il periodo di un movimento, a seconda di che classifica si sta guardando. */
create or replace function periodo_di(tipo text, quando timestamptz)
returns text
language sql
immutable
as $$
  select case tipo
    when 'settimana' then settimana_di(quando)
    when 'mese'      then mese_di(quando)
    when 'stagione'  then stagione_di(quando)
    else 'sempre'
  end;
$$;

/* ------------------------------------------------------------- le classifiche */

/*
 * La classifica, con il numero di posizione gia dentro.
 *
 * Calcolarla nell'app vorrebbe dire scaricare i movimenti di tutti, che e sia
 * lento sia sbagliato: i movimenti altrui non si leggono, ed e giusto cosi.
 * Qui esce solo quello che serve vedere -- nome, immagine, punti -- e i punti
 * li somma il database.
 *
 * A parita di punti vince chi ci e arrivato prima: senza, due persone si
 * scambiano di posto a ogni ricarica e sembra che la classifica balli.
 */
create or replace function classifica(tipo text default 'settimana', quanti int default 50, quando timestamptz default now())
returns table (posizione int, utente uuid, nome text, avatar text, punti int, azioni int)
language sql
stable
security definer
set search_path = public
as $$
  with somme as (
    select m.utente,
           sum(m.punti)::int as punti,
           count(*)::int as azioni,
           min(m.creato_il) as primo
    from punti_movimenti m
    where periodo_di(tipo, m.creato_il) = periodo_di(tipo, quando)
    group by m.utente
  )
  select
    row_number() over (order by s.punti desc, s.primo asc)::int as posizione,
    s.utente, p.nome, p.avatar, s.punti, s.azioni
  from somme s
  join profiles p on p.id = s.utente
  order by s.punti desc, s.primo asc
  limit greatest(quanti, 1);
$$;

/*
 * La propria riga, anche quando si e oltre i primi cinquanta.
 *
 * Senza questa, chi e centesimo apre la classifica e non si trova: e il modo
 * piu rapido di far chiudere la schermata.
 */
create or replace function mia_posizione(tipo text default 'settimana', quando timestamptz default now())
returns table (posizione int, punti int, azioni int, quanti_in_classifica int)
language sql
stable
security definer
set search_path = public
as $$
  with somme as (
    select m.utente,
           sum(m.punti)::int as punti,
           count(*)::int as azioni,
           min(m.creato_il) as primo
    from punti_movimenti m
    where periodo_di(tipo, m.creato_il) = periodo_di(tipo, quando)
    group by m.utente
  ), con_posizione as (
    select utente, punti, azioni,
           row_number() over (order by punti desc, primo asc)::int as posizione,
           count(*) over ()::int as totale
    from somme
  )
  select posizione, punti, azioni, totale
  from con_posizione
  where utente = auth.uid();
$$;

/** Il totale di sempre: quello che sta sul profilo. */
create or replace function punti_totali(chi uuid default auth.uid())
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(punti), 0)::int from punti_movimenti where utente = chi;
$$;

/* ------------------------------------------------------------------ i livelli */

create table if not exists livelli (
  soglia int primary key,
  nome   text not null,
  colore text not null
);

alter table livelli enable row level security;

drop policy if exists "i livelli li legge chiunque" on livelli;
create policy "i livelli li legge chiunque"
  on livelli for select using (true);

insert into livelli (soglia, nome, colore) values
  (0,    'Curva Sud', '#9aa0a6'),
  (250,  'Rossonero', '#ee1111'),
  (1000, 'Ultras',    '#ffb300'),
  (3000, 'Leggenda',  '#8e7cff')
on conflict (soglia) do nothing;

create or replace function livello_di(punti int)
returns text
language sql
stable
as $$
  select nome from livelli where soglia <= coalesce(punti, 0) order by soglia desc limit 1;
$$;

/* ------------------------------------------------------------------- i badge */

create table if not exists badge (
  codice      text primary key,
  nome        text not null,
  descrizione text not null,
  icona       text not null
);

alter table badge enable row level security;

drop policy if exists "i badge li legge chiunque" on badge;
create policy "i badge li legge chiunque"
  on badge for select using (true);

insert into badge (codice, nome, descrizione, icona) values
  ('primo-pronostico', 'Primo pronostico', 'Hai detto come finiva prima che finisse.', 'flash'),
  ('dieci-pronostici', 'Dieci volte',      'Dieci pronostici messi: non era una volta sola.', 'repeat'),
  ('risultato-esatto', 'Occhio clinico',   'Un risultato esatto, virgola compresa.', 'eye'),
  ('tre-esatti',       'Chiaroveggente',   'Tre risultati esatti. Comincia a essere sospetto.', 'sparkles'),
  ('quiz-dieci',       'Memoria di ferro', 'Dieci risposte giuste al quiz.', 'school'),
  ('mvp-cinque',       'Giudice',          'Cinque volte hai scelto il migliore in campo.', 'star'),
  ('mille-punti',      'Mille',            'Mille punti. Non si arriva per caso.', 'trophy')
on conflict (codice) do nothing;

create table if not exists badge_utente (
  utente    uuid not null references profiles on delete cascade,
  badge     text not null references badge (codice),
  preso_il  timestamptz not null default now(),
  primary key (utente, badge)
);

alter table badge_utente enable row level security;

-- I badge altrui si vedono: sono il motivo per cui uno li vuole.
drop policy if exists "i badge presi li vede chiunque" on badge_utente;
create policy "i badge presi li vede chiunque"
  on badge_utente for select using (true);

/*
 * I badge si ricalcolano, non si assegnano a mano.
 *
 * Parte dai movimenti, che sono il fatto; il badge e solo un riassunto. Se un
 * giorno si aggiunge un badge nuovo, questa funzione lo da anche a chi aveva
 * gia fatto quello che serve, senza dover rifare la storia.
 */
create or replace function aggiorna_badge(chi uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  pronostici_fatti int;
  esatti int;
  quiz_giusti int;
  mvp_dati int;
  totale int;
  nuovi int := 0;

  da_dare text[];
begin
  if chi is null then return 0; end if;

  select
    count(*) filter (where azione = 'pronostico'),
    count(*) filter (where azione = 'risultato'),
    count(*) filter (where azione = 'quiz'),
    count(*) filter (where azione = 'mvp'),
    coalesce(sum(punti), 0)
  into pronostici_fatti, esatti, quiz_giusti, mvp_dati, totale
  from punti_movimenti where utente = chi;

  da_dare := array[]::text[];
  if pronostici_fatti >= 1  then da_dare := da_dare || 'primo-pronostico'::text; end if;
  if pronostici_fatti >= 10 then da_dare := da_dare || 'dieci-pronostici'::text; end if;
  if esatti >= 1            then da_dare := da_dare || 'risultato-esatto'::text; end if;
  if esatti >= 3            then da_dare := da_dare || 'tre-esatti'::text; end if;
  if quiz_giusti >= 10      then da_dare := da_dare || 'quiz-dieci'::text; end if;
  if mvp_dati >= 5          then da_dare := da_dare || 'mvp-cinque'::text; end if;
  if totale >= 1000         then da_dare := da_dare || 'mille-punti'::text; end if;

  insert into badge_utente (utente, badge)
  select chi, b from unnest(da_dare) as b
  on conflict (utente, badge) do nothing;

  get diagnostics nuovi = row_count;
  return nuovi;
end $$;

/* Dopo ogni movimento si ricontrollano i badge di quella persona sola. */
create or replace function badge_dopo_i_punti()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform aggiorna_badge(new.utente);
  return new;
end $$;

drop trigger if exists badge_aggiornati on punti_movimenti;
create trigger badge_aggiornati after insert on punti_movimenti
  for each row execute function badge_dopo_i_punti();
