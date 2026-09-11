-- Quiz e sondaggi del Match Center.
--
-- LA RISPOSTA GIUSTA NON ESCE MAI DAL DATABASE PRIMA DEL TEMPO
--
-- Un quiz il cui client conosce la risposta non e un quiz: la chiave anonima
-- sta dentro l'app, chiunque puo interrogare l'API e leggersi la colonna. Qui
-- la tabella delle domande non ha nessuna politica di lettura -- non la legge
-- nessuno -- e l'app vede una vista che quella colonna non ce l'ha. La
-- risposta si scopre rispondendo, da una funzione che controlla anche che la
-- finestra sia aperta.
--
-- Lo stesso vale per i punti: li da la funzione, non il client.

/* ------------------------------------------------------------------- quiz */

create table if not exists quiz_domande (
  id          uuid primary key default gen_random_uuid(),
  -- null = quiz del giorno, non legato a una partita
  partita     text,
  fase        text not null check (fase in ('pre', 'live', 'intervallo', 'post', 'giornaliero')),
  testo       text not null check (char_length(testo) between 5 and 300),
  opzioni     text[] not null check (array_length(opzioni, 1) between 2 and 5),
  giusta      smallint not null check (giusta >= 0),
  spiegazione text,
  apre_il     timestamptz,
  chiude_il   timestamptz,
  ordine      smallint not null default 0,
  creato_il   timestamptz not null default now(),
  check (giusta < array_length(opzioni, 1))
);

create index if not exists quiz_per_partita on quiz_domande (partita, fase, ordine);

alter table quiz_domande enable row level security;

-- Nessuna politica di lettura, apposta. Chi scrive le domande passa dal
-- pannello o e amministratore.
drop policy if exists "le domande le scrive un amministratore" on quiz_domande;
create policy "le domande le scrive un amministratore"
  on quiz_domande for all using (e_admin()) with check (e_admin());

/*
 * Quello che l'app puo vedere: tutto tranne la risposta.
 *
 * La vista gira con i permessi di chi l'ha creata, quindi supera la sicurezza
 * per riga della tabella. E il motivo per cui esiste: la tabella resta chiusa,
 * la vista apre solo le colonne innocue.
 */
create or replace view quiz_pubblici as
  select id, partita, fase, testo, opzioni, apre_il, chiude_il, ordine,
         (apre_il is null or apre_il <= now()) and (chiude_il is null or chiude_il > now()) as aperta
  from quiz_domande;

grant select on quiz_pubblici to anon, authenticated;

create table if not exists quiz_risposte (
  utente    uuid not null references profiles on delete cascade,
  domanda   uuid not null references quiz_domande on delete cascade,
  scelta    smallint not null,
  giusta    boolean not null,
  creato_il timestamptz not null default now(),
  primary key (utente, domanda)
);

alter table quiz_risposte enable row level security;

-- La propria risposta si rilegge (serve a mostrare cosa si era detto), quelle
-- altrui no: in un quiz a tempo sarebbero la soluzione.
drop policy if exists "ognuno vede le proprie risposte" on quiz_risposte;
create policy "ognuno vede le proprie risposte"
  on quiz_risposte for select using (auth.uid() = utente);

/*
 * Rispondere, una volta sola.
 *
 * Si risponde e si scopre; ripensarci non si puo, se no si prova finche non si
 * indovina. Se la risposta c'era gia si restituisce quella, senza ripagare: e
 * il caso della rete che manda due volte la stessa cosa.
 */
create or replace function rispondi_quiz(la_domanda uuid, la_scelta smallint)
returns table (esatta boolean, corretta smallint, spiegazione text, punti int, gia_risposto boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  precedente record;
  giusto boolean;
  pagati int := 0;
begin
  if auth.uid() is null then
    raise exception 'serve un account per rispondere' using errcode = 'insufficient_privilege';
  end if;

  select * into d from quiz_domande where id = la_domanda;
  if not found then
    raise exception 'domanda inesistente' using errcode = 'no_data_found';
  end if;

  select * into precedente from quiz_risposte where utente = auth.uid() and domanda = la_domanda;
  if found then
    return query select precedente.giusta, d.giusta, d.spiegazione, 0, true;
    return;
  end if;

  if (d.apre_il is not null and d.apre_il > now())
     or (d.chiude_il is not null and d.chiude_il <= now()) then
    raise exception 'questa domanda non e aperta' using errcode = 'check_violation';
  end if;

  if la_scelta < 0 or la_scelta >= array_length(d.opzioni, 1) then
    raise exception 'risposta fuori elenco' using errcode = 'check_violation';
  end if;

  giusto := (la_scelta = d.giusta);
  insert into quiz_risposte (utente, domanda, scelta, giusta)
  values (auth.uid(), la_domanda, la_scelta, giusto);

  if giusto then
    pagati := assegna_punti(auth.uid(), 'quiz', la_domanda::text);
  end if;

  return query select giusto, d.giusta, d.spiegazione, pagati, false;
end $$;

/** Quante ne ha prese: serve al riepilogo di fine partita e al profilo. */
create or replace function quiz_fatti(la_partita text default null)
returns table (risposte int, giuste int)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int, count(*) filter (where r.giusta)::int
  from quiz_risposte r
  join quiz_domande d on d.id = r.domanda
  where r.utente = auth.uid()
    and (la_partita is null or d.partita = la_partita);
$$;

/* --------------------------------------------------------------- sondaggi */

create table if not exists sondaggi (
  id        uuid primary key default gen_random_uuid(),
  partita   text,
  fase      text not null check (fase in ('pre', 'live', 'intervallo', 'post', 'sempre')),
  testo     text not null check (char_length(testo) between 5 and 300),
  opzioni   text[] not null check (array_length(opzioni, 1) between 2 and 6),
  apre_il   timestamptz,
  chiude_il timestamptz,
  ordine    smallint not null default 0,
  creato_il timestamptz not null default now()
);

create index if not exists sondaggi_per_partita on sondaggi (partita, fase, ordine);

alter table sondaggi enable row level security;

-- I sondaggi si leggono: non c'e niente da nascondere, la domanda e la domanda.
drop policy if exists "i sondaggi li legge chiunque" on sondaggi;
create policy "i sondaggi li legge chiunque"
  on sondaggi for select using (true);

drop policy if exists "i sondaggi li scrive un amministratore" on sondaggi;
create policy "i sondaggi li scrive un amministratore"
  on sondaggi for all using (e_admin()) with check (e_admin());

create table if not exists sondaggio_voti (
  utente     uuid not null references profiles on delete cascade,
  sondaggio  uuid not null references sondaggi on delete cascade,
  scelta     smallint not null,
  votato_il  timestamptz not null default now(),
  primary key (utente, sondaggio)
);

alter table sondaggio_voti enable row level security;

drop policy if exists "ognuno vede il proprio voto" on sondaggio_voti;
create policy "ognuno vede il proprio voto"
  on sondaggio_voti for select using (auth.uid() = utente);

/*
 * I risultati: quanti hanno scelto cosa.
 *
 * I voti singoli restano privati e escono solo contati, come per le pagelle.
 * Sapere che Tizio ha votato "male" a "come sta giocando il Foggia" non serve a
 * nessuno e in una chat di tifosi serve anche meno.
 */
create or replace view sondaggio_risultati as
  select sondaggio, scelta, count(*)::int as quanti
  from sondaggio_voti
  group by sondaggio, scelta;

grant select on sondaggio_risultati to anon, authenticated;

/*
 * Votare, e potersi ricredere finche e aperto.
 *
 * Al contrario del quiz: qui non c'e una risposta giusta da proteggere, e uno
 * che cambia idea a caldo e la cosa piu normale del mondo. I punti pero si
 * danno una volta sola, perche la chiave e il sondaggio.
 */
create or replace function vota_sondaggio(il_sondaggio uuid, la_scelta smallint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  if auth.uid() is null then
    raise exception 'serve un account per votare' using errcode = 'insufficient_privilege';
  end if;

  select * into s from sondaggi where id = il_sondaggio;
  if not found then
    raise exception 'sondaggio inesistente' using errcode = 'no_data_found';
  end if;

  if (s.apre_il is not null and s.apre_il > now())
     or (s.chiude_il is not null and s.chiude_il <= now()) then
    raise exception 'questo sondaggio non e aperto' using errcode = 'check_violation';
  end if;

  if la_scelta < 0 or la_scelta >= array_length(s.opzioni, 1) then
    raise exception 'scelta fuori elenco' using errcode = 'check_violation';
  end if;

  insert into sondaggio_voti (utente, sondaggio, scelta)
  values (auth.uid(), il_sondaggio, la_scelta)
  on conflict (utente, sondaggio) do update set scelta = excluded.scelta, votato_il = now();

  return assegna_punti(auth.uid(), 'sondaggio', il_sondaggio::text);
end $$;
