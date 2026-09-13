/*
 * Sicurezza e calendario.
 *
 * Tutto quello che c'e qui e stato trovato provando, non leggendo: le 40
 * migrazioni caricate su un Postgres vero e attaccate da un utente qualsiasi e
 * da un anonimo. Ogni blocco dice cosa riusciva prima.
 *
 * CHI CHIAMA
 *
 * Molti controlli qui guardano `current_user`. Una richiesta dall'app arriva
 * al database come `authenticated` o `anon`; dentro una funzione `security
 * definer` invece `current_user` e il proprietario della funzione. Quindi un
 * trigger `security invoker` distingue da solo "l'ha scritto un telefono" da
 * "l'ha scritto una funzione che ha gia controllato chi chiama" -- senza
 * variabili di sessione, che un domani qualcuno potrebbe trovare il modo di
 * impostare da fuori.
 */

-- =====================================================================
-- 1. IL CALENDARIO, E IL PONTE FRA I DUE NUMERI DI UNA PARTITA
-- =====================================================================
/*
 * L'app chiama le partite con l'id del calendario (`wp-2026-2027-004`), il
 * guardiano con quello di TheSportsDB (`2555023`). Nessuno dei due conosceva
 * l'altro, e le conseguenze erano tre, tutte mute:
 *
 * - il pronostico non si chiudeva mai al fischio d'inizio: il trigger cercava
 *   `wp-...` in stato_partita, non lo trovava, e lasciava passare;
 * - a partita chiusa nessuno prendeva i punti per esito o risultato:
 *   chiudi_partita cercava i pronostici di `2555023`, e ce n'erano zero;
 * - i punti per pronostici, pagelle e migliore in campo si davano per QUALSIASI
 *   codice partita. Cinquecento pronostici su partite inventate valevano
 *   cinquemila punti e il primo posto in classifica.
 *
 * Il calendario lo scrive il guardiano, che lo legge dal repository. Il ponte
 * lo fa l'ora del calcio d'inizio: il Foggia non gioca due partite a tre ore di
 * distanza, e le due fonti riportano lo stesso orario al secondo.
 */
create table if not exists calendario (
  partita       text primary key check (char_length(partita) between 1 and 64),
  kickoff       timestamptz not null,
  event_id      text unique,
  casa          smallint check (casa between 0 and 30),
  ospiti        smallint check (ospiti between 0 and 30),
  finita        boolean not null default false,
  aggiornato_il timestamptz not null default now()
);

alter table calendario enable row level security;
drop policy if exists "il calendario lo legge chiunque" on calendario;
create policy "il calendario lo legge chiunque" on calendario for select using (true);

/** L'id dell'app per una partita, da qualunque dei due numeri si parta. */
create or replace function partita_app(p text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select c.partita from calendario c where c.partita = p),
    (select c.partita from calendario c where c.event_id = p)
  );
$$;

/** L'id del guardiano per una partita, da qualunque dei due numeri si parta. */
create or replace function partita_guardiano(p text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select s.partita from stato_partita s where s.partita = p),
    (select c.event_id from calendario c where c.partita = p)
  );
$$;

create or replace function chiudi_partita(la_partita text, gol_casa integer, gol_ospiti integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  app text := partita_app(la_partita);
  guardiano text := partita_guardiano(la_partita);
  -- i punti si contano sull'id dell'app, lo stesso dei pronostici
  chiave text := coalesce(app, la_partita);
  r record;
  pagati int := 0;
begin
  insert into partite_chiuse (partita, casa, ospiti)
  select distinct x, gol_casa, gol_ospiti
  from unnest(array[la_partita, app, guardiano]) as x
  where x is not null
  on conflict (partita) do nothing;

  for r in
    select distinct on (utente) utente, casa, ospiti
    from pronostici
    where partita in (la_partita, app, guardiano)
    order by utente, (partita = chiave) desc
  loop
    if r.casa = gol_casa and r.ospiti = gol_ospiti then
      pagati := pagati + assegna_punti(r.utente, 'risultato', chiave);
    elsif esito_di(r.casa, r.ospiti) = esito_di(gol_casa, gol_ospiti) then
      pagati := pagati + assegna_punti(r.utente, 'esito', chiave);
    end if;
  end loop;

  return pagati;
end $$;

create or replace function pronostico_prima_del_fischio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app text := partita_app(new.partita);
  guardiano text := partita_guardiano(new.partita);
  inizio timestamptz;
  finita timestamptz;
begin
  select s.kickoff, s.finita_il into inizio, finita
    from stato_partita s where s.partita = guardiano;

  if inizio is null then
    select c.kickoff into inizio from calendario c where c.partita = app;
  end if;

  if finita is not null
     or (inizio is not null and now() >= inizio)
     or exists (select 1 from partite_chiuse p where p.partita in (new.partita, app, guardiano)) then
    raise exception 'la partita e gia cominciata: i pronostici si chiudono al fischio d''inizio';
  end if;

  return new;
end $$;

-- i punti si danno solo per partite che esistono
create or replace function punti_per_pronostico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app text := partita_app(new.partita);
begin
  if app is not null then
    perform assegna_punti(new.utente, 'pronostico', app);
  end if;
  return new;
end $$;

-- e per pagelle e migliore in campo, solo per partite gia cominciate
create or replace function punti_per_pagelle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app text := partita_app(new.partita);
begin
  if app is not null and exists (select 1 from calendario c where c.partita = app and c.kickoff <= now()) then
    perform assegna_punti(new.utente, 'pagelle', app);
  end if;
  return new;
end $$;

create or replace function punti_per_mvp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app text := partita_app(new.partita);
begin
  if app is not null and exists (select 1 from calendario c where c.partita = app and c.kickoff <= now()) then
    perform assegna_punti(new.utente, 'mvp', app);
  end if;
  return new;
end $$;

/*
 * Il guardiano passa il calendario, qui si fa il resto.
 *
 * E ripetibile senza danni: ogni punto passa da assegna_punti, che non paga due
 * volte la stessa chiave, e ogni chiusura da chiudi_partita, che non riscrive
 * un risultato gia registrato.
 */
create or replace function allinea_calendario(p_partite jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  ponti int := 0;
  chiuse int := 0;
  pc_casa smallint;
  pc_ospiti smallint;
begin
  if jsonb_typeof(p_partite) is distinct from 'array' then
    raise exception 'serve un elenco di partite';
  end if;

  insert into calendario (partita, kickoff, casa, ospiti, finita, aggiornato_il)
  select x->>'partita',
         (x->>'kickoff')::timestamptz,
         (x->>'casa')::smallint,
         (x->>'ospiti')::smallint,
         coalesce((x->>'finita')::boolean, false),
         now()
  from jsonb_array_elements(p_partite) x
  where coalesce(x->>'partita', '') <> '' and coalesce(x->>'kickoff', '') <> ''
  on conflict (partita) do update
    set kickoff = excluded.kickoff,
        casa = excluded.casa,
        ospiti = excluded.ospiti,
        finita = excluded.finita,
        aggiornato_il = now();

  -- il ponte: stesso calcio d'inizio, entro tre ore, il piu vicino
  with coppie as (
    select distinct on (s.partita) s.partita as ev, c.partita as app
    from stato_partita s
    join calendario c on abs(extract(epoch from (c.kickoff - s.kickoff))) <= 3 * 3600
    where s.kickoff is not null
      and c.event_id is null
      and not exists (select 1 from calendario c2 where c2.event_id = s.partita)
    order by s.partita, abs(extract(epoch from (c.kickoff - s.kickoff)))
  )
  update calendario c set event_id = coppie.ev
  from coppie where c.partita = coppie.app;
  get diagnostics ponti = row_count;

  -- il punteggio che il guardiano aveva cancellato dopo il fischio
  update stato_partita s set casa = pc.casa, ospiti = pc.ospiti
  from partite_chiuse pc
  where pc.partita = s.partita and s.casa is null and s.finita_il is not null;

  update stato_partita s set casa = c.casa, ospiti = c.ospiti
  from calendario c
  where c.event_id = s.partita and s.casa is null and s.finita_il is not null
    and c.finita and c.casa is not null and c.ospiti is not null;

  -- le partite finite e mai chiuse con l'id dell'app
  for r in
    select c.partita, c.event_id,
           coalesce(s.casa, c.casa) as casa,
           coalesce(s.ospiti, c.ospiti) as ospiti
    from calendario c
    left join stato_partita s on s.partita = c.event_id
    where (c.finita or s.finita_il is not null)
      and not exists (select 1 from partite_chiuse pc where pc.partita = c.partita)
  loop
    -- se il guardiano l'aveva gia chiusa, vale il suo punteggio
    pc_casa := null; pc_ospiti := null;
    select pc.casa, pc.ospiti into pc_casa, pc_ospiti
      from partite_chiuse pc where pc.partita = r.event_id;

    if coalesce(pc_casa, r.casa) is not null and coalesce(pc_ospiti, r.ospiti) is not null then
      perform chiudi_partita(r.partita, coalesce(pc_casa, r.casa), coalesce(pc_ospiti, r.ospiti));
      chiuse := chiuse + 1;
    end if;
  end loop;

  -- i punti che non erano stati dati per colpa del ponte mancante
  perform assegna_punti(p.utente, 'pronostico', c.partita)
    from pronostici p join calendario c on c.partita = p.partita;
  perform assegna_punti(v.utente, 'pagelle', c.partita)
    from (select distinct utente, partita from voti) v
    join calendario c on c.partita = v.partita and c.kickoff <= now();
  perform assegna_punti(m.utente, 'mvp', c.partita)
    from mvp_voti m join calendario c on c.partita = m.partita and c.kickoff <= now();

  return jsonb_build_object(
    'partite', jsonb_array_length(p_partite),
    'ponti', ponti,
    'chiuse', chiuse
  );
end $$;

revoke execute on function allinea_calendario(jsonb) from public, anon, authenticated;
revoke execute on function chiudi_partita(text, integer, integer) from public, anon, authenticated;

-- =====================================================================
-- 2. RUOLO, SOSPENSIONE, NOME E IMMAGINE DEL PROFILO
-- =====================================================================
/*
 * Prima il trigger si fidava di una variabile di sessione impostata dalle
 * funzioni del pannello, e lasciava fare a un admin qualsiasi modifica diretta:
 * cosi un admin poteva togliere il ruolo a un altro admin scavalcando
 * imposta_ruolo, che proprio questo impedisce. E un profilo inserito a mano
 * poteva nascere gia admin.
 *
 * Adesso dall'app il ruolo e la sospensione non si toccano mai direttamente:
 * si passa dalle funzioni del pannello, che controllano chi chiama e su chi.
 */
create or replace function nome_pulito(t text)
returns text
language sql
immutable
as $$
  -- via i caratteri invisibili e quelli che rovesciano il verso del testo:
  -- con quelli "Admin" si scrive in modo che sembri un'altra cosa. Resta
  -- U+200D, che tiene insieme le emoji composte.
  select nullif(btrim(regexp_replace(t, '[-­​‌‎‏‪-‮⁠-⁩﻿]', '', 'g')), '');
$$;

/** Come nome_pulito, ma i ritorni a capo restano: serve alla presentazione. */
create or replace function testo_pulito(t text)
returns text
language sql
immutable
as $$
  select nullif(btrim(regexp_replace(t, '[-	-­​‌‎‏‪-‮⁠-⁩﻿]', '', 'g')), '');
$$;

create or replace function proteggi_ruolo()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.ruolo := 'utente';
    new.sospeso_fino := null;
  elsif new.ruolo is distinct from old.ruolo or new.sospeso_fino is distinct from old.sospeso_fino then
    raise exception 'il ruolo e la sospensione si cambiano dal pannello';
  end if;

  new.nome := nome_pulito(new.nome);
  new.bio := testo_pulito(new.bio);

  -- l'immagine del profilo sta sul nostro archivio, nella cartella di chi la usa:
  -- un indirizzo qualsiasi portava in classifica immagini da server altrui
  if new.avatar is not null
     and (tg_op = 'INSERT' or new.avatar is distinct from old.avatar)
     and new.avatar !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatar/'
                        || new.id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'l''immagine del profilo si carica dall''app';
  end if;

  return new;
end $$;

drop trigger if exists ruolo_protetto on profiles;
create trigger ruolo_protetto before insert or update on profiles
  for each row execute function proteggi_ruolo();

-- una email come a@gmail.com non deve far fallire la registrazione intera
create or replace function crea_profilo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scelto text;
begin
  scelto := left(coalesce(
    nome_pulito(new.raw_user_meta_data ->> 'nome'),
    nome_pulito(split_part(new.email, '@', 1)),
    ''
  ), 40);
  if char_length(btrim(scelto)) < 2 then
    scelto := 'Tifoso ' || left(new.id::text, 4);
  end if;

  insert into public.profiles (id, nome)
  values (new.id, btrim(scelto))
  on conflict (id) do nothing;
  return new;
end $$;

-- =====================================================================
-- 3. DISCUSSIONI, RISPOSTE, MESSAGGI: CHI CAMBIA COSA
-- =====================================================================
/*
 * Le politiche dicono quali righe, non quali colonne. Da qui:
 *
 * - l'autore di una discussione nascosta dai moderatori la rendeva di nuovo
 *   visibile con un aggiornamento senza filtro;
 * - l'autore la fissava in cima alla Curva mettendo l'ultima attivita al 2099;
 * - un moderatore poteva riscrivere il testo di un altro;
 * - un utente sospeso poteva ancora modificare quello che aveva scritto.
 *
 * Il nome del trigger comincia con "aa" perche i trigger partono in ordine
 * alfabetico, e questo deve vedere la modifica prima che copri_offese la tocchi.
 */
create or replace function custodisci_contenuto()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  vecchio jsonb := to_jsonb(old);
  nuovo jsonb := to_jsonb(new);
  campo text;
  col_autore text;
  col_nascosta text;
  fissi text[];
  scritti text[];
  testo_cambiato boolean := false;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_table_name = 'discussioni' then
    col_autore := 'autore'; col_nascosta := 'nascosta';
    fissi := array['id', 'autore', 'creata_il', 'attiva_il'];
    scritti := array['titolo', 'testo', 'argomento'];
  elsif tg_table_name = 'risposte' then
    col_autore := 'autore'; col_nascosta := 'nascosta';
    fissi := array['id', 'autore', 'discussione', 'creata_il'];
    scritti := array['testo'];
  elsif tg_table_name = 'messaggi_live' then
    col_autore := 'utente'; col_nascosta := 'nascosto';
    fissi := array['id', 'utente', 'partita', 'creato_il'];
    scritti := array['testo'];
  else
    return new;
  end if;

  foreach campo in array fissi loop
    if nuovo -> campo is distinct from vecchio -> campo then
      raise exception 'questo campo non si modifica: %', campo;
    end if;
  end loop;

  if nuovo -> col_nascosta is distinct from vecchio -> col_nascosta and not e_moderatore() then
    raise exception 'nascondere o rendere visibile spetta a chi modera';
  end if;

  foreach campo in array scritti loop
    if nuovo -> campo is distinct from vecchio -> campo then
      testo_cambiato := true;
    end if;
  end loop;

  if testo_cambiato then
    if auth.uid() is null or auth.uid()::text is distinct from vecchio ->> col_autore then
      raise exception 'si modifica solo quello che si e scritto';
    end if;
    if sono_sospeso() then
      raise exception 'account sospeso: non puoi pubblicare fino alla scadenza';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists aa_custodisci on discussioni;
create trigger aa_custodisci before update on discussioni
  for each row execute function custodisci_contenuto();
drop trigger if exists aa_custodisci on risposte;
create trigger aa_custodisci before update on risposte
  for each row execute function custodisci_contenuto();
drop trigger if exists aa_custodisci on messaggi_live;
create trigger aa_custodisci before update on messaggi_live
  for each row execute function custodisci_contenuto();

-- la trasferta di un sospeso non si riscrive
drop trigger if exists sospesi_zitti_modifica on trasferte;
create trigger sospesi_zitti_modifica before update on trasferte
  for each row execute function blocca_sospesi();

-- =====================================================================
-- 4. IL FRENO
-- =====================================================================
/*
 * Duecento messaggi in chat in un'unica richiesta passavano. Durante una
 * partita basta una persona per rendere la sala illeggibile a tutti.
 * I numeri sono larghi per chi scrive a mano e stretti per uno script.
 */
create or replace function frena_raffiche()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  col_autore text := tg_argv[0];
  col_data text := tg_argv[1];
  tetto int := tg_argv[2]::int;
  finestra interval := tg_argv[3]::interval;
  quanti int;
begin
  if auth.uid() is null then
    return new;
  end if;

  execute format(
    'select count(*) from %I where %I = $1 and %I > now() - $2',
    tg_table_name, col_autore, col_data
  ) into quanti using auth.uid(), finestra;

  if quanti >= tetto then
    raise exception 'stai scrivendo troppo in fretta: aspetta un momento e riprova';
  end if;

  return new;
end $$;

create index if not exists messaggi_live_per_utente on messaggi_live (utente, creato_il desc);
create index if not exists discussioni_per_autore on discussioni (autore, creata_il desc);
create index if not exists risposte_per_autore on risposte (autore, creata_il desc);
create index if not exists segnalazioni_per_segnalante on segnalazioni (segnalante, creata_il desc);

drop trigger if exists freno on messaggi_live;
create trigger freno before insert on messaggi_live
  for each row execute function frena_raffiche('utente', 'creato_il', '8', '1 minute');
drop trigger if exists freno on discussioni;
create trigger freno before insert on discussioni
  for each row execute function frena_raffiche('autore', 'creata_il', '6', '1 hour');
drop trigger if exists freno on risposte;
create trigger freno before insert on risposte
  for each row execute function frena_raffiche('autore', 'creata_il', '30', '10 minutes');
drop trigger if exists freno on segnalazioni;
create trigger freno before insert on segnalazioni
  for each row execute function frena_raffiche('segnalante', 'creata_il', '20', '1 hour');

-- =====================================================================
-- 5. SEGNALAZIONI
-- =====================================================================
/*
 * Una segnalazione si poteva inserire gia "accolta", con la firma di un admin
 * e una nota del moderatore scritta da chi segnalava.
 */
create or replace function segnalazione_nuova()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  new.stato := 'aperta';
  new.gestita_il := null;
  new.gestita_da := null;
  new.nota_moderatore := null;
  new.creata_il := now();

  if new.tipo in ('discussione', 'risposta', 'messaggio', 'profilo')
     and new.bersaglio !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'segnalazione non valida';
  end if;
  if new.tipo = 'trasferta'
     and new.bersaglio !~* '^[^:]{1,64}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'segnalazione non valida';
  end if;

  return new;
end $$;

drop trigger if exists segnalazione_pulita on segnalazioni;
create trigger segnalazione_pulita before insert on segnalazioni
  for each row execute function segnalazione_nuova();

-- =====================================================================
-- 6. ISCRIZIONI ALLE NOTIFICHE
-- =====================================================================
/*
 * Le politiche lasciavano modificare e cancellare a chiunque le iscrizioni
 * senza account. Un anonimo le cancellava tutte, oppure riscriveva l'indirizzo
 * di consegna: il guardiano avrebbe poi mandato le notifiche a un server
 * scelto da lui. E l'indirizzo non veniva controllato affatto, quindi il
 * guardiano si poteva mandare a bussare a indirizzi di rete qualsiasi.
 *
 * Adesso chi non ha un account passa solo dalle funzioni, e l'indirizzo e
 * l'identificativo dell'iscrizione: chi lo conosce e il browser che l'ha
 * creata.
 */
drop policy if exists "chiunque puo iscriversi" on push_iscrizioni;
drop policy if exists "si modifica la propria iscrizione" on push_iscrizioni;
drop policy if exists "si cancella la propria iscrizione" on push_iscrizioni;

create policy "si modifica la propria iscrizione" on push_iscrizioni
  for update using (auth.uid() = utente) with check (auth.uid() = utente);
create policy "si cancella la propria iscrizione" on push_iscrizioni
  for delete using (auth.uid() = utente);

create or replace function endpoint_ammesso(p text)
returns boolean
language sql
immutable
as $$
  select p ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.apple\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com)/[^\s]+$'
     and char_length(p) <= 1024;
$$;

create or replace function preferenze_ammesse(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and pg_column_size(p) <= 1024
    and not exists (select 1 from jsonb_each(p) e where jsonb_typeof(e.value) <> 'boolean')
  );
$$;

alter table push_iscrizioni drop constraint if exists push_endpoint_ammesso;
alter table push_iscrizioni add constraint push_endpoint_ammesso
  check (endpoint_ammesso(endpoint)) not valid;
alter table push_iscrizioni drop constraint if exists push_preferenze_ammesse;
alter table push_iscrizioni add constraint push_preferenze_ammesse
  check (preferenze_ammesse(preferenze)) not valid;

create or replace function iscrivi_notifiche(p_endpoint text, p_p256dh text, p_auth text, p_preferenze jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_endpoint is null or p_p256dh is null or p_auth is null then
    raise exception 'iscrizione incompleta';
  end if;
  if not endpoint_ammesso(p_endpoint)
     or char_length(p_p256dh) > 200 or char_length(p_auth) > 100
     or not preferenze_ammesse(p_preferenze) then
    raise exception 'iscrizione non valida';
  end if;

  insert into push_iscrizioni (endpoint, utente, p256dh, auth, preferenze, visto_il)
  values (
    p_endpoint,
    auth.uid(),
    p_p256dh,
    p_auth,
    coalesce(p_preferenze, '{"formazioni":true,"inizio":true,"gol":true,"espulsione":true,"fine":true}'::jsonb),
    now()
  )
  on conflict (endpoint) do update
    set utente     = auth.uid(),
        p256dh     = excluded.p256dh,
        auth       = excluded.auth,
        preferenze = excluded.preferenze,
        visto_il   = now();
end $$;

create or replace function preferenze_notifiche(p_endpoint text, p_preferenze jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_preferenze is null or not preferenze_ammesse(p_preferenze) then
    raise exception 'preferenze non valide';
  end if;
  update push_iscrizioni
     set preferenze = p_preferenze, visto_il = now()
   where endpoint = p_endpoint;
end $$;

create or replace function disiscrivi_notifiche(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_iscrizioni where endpoint = p_endpoint;
$$;

grant execute on function disiscrivi_notifiche(text) to anon, authenticated;

-- =====================================================================
-- 7. CONTATTI DELLE TRASFERTE
-- =====================================================================
/*
 * Chi hai bloccato non vede il tuo numero, e tu non vedi il suo.
 *
 * Il controllo sta in una funzione perche i blocchi degli altri non si leggono:
 * dentro la politica, "Carla ha bloccato Eva" e invisibile proprio a Eva. La
 * funzione risponde solo si o no su una coppia, e un no Eva lo ricaverebbe
 * comunque dal contatto che non vede.
 */
create or replace function contatto_visibile(p_partita text, p_utente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (select 1 from trasferte t where t.partita = p_partita and t.utente = auth.uid())
    and not exists (
      select 1 from blocchi b
      where (b.utente = auth.uid() and b.bloccato = p_utente)
         or (b.utente = p_utente and b.bloccato = auth.uid())
    );
$$;

drop policy if exists "i contatti li vede chi va a quella trasferta" on trasferte_contatti;
create policy "i contatti li vede chi va a quella trasferta" on trasferte_contatti
  for select using (contatto_visibile(partita, utente));

-- =====================================================================
-- 8. LUNGHEZZE
-- =====================================================================
/*
 * Colonne di testo senza limite: una "presenza" con un settore di centomila
 * caratteri entrava. `not valid` lascia stare le righe che ci sono gia.
 */
do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('pronostici', 'partita', 64),
      ('voti', 'partita', 64), ('voti', 'giocatore', 120),
      ('mvp_voti', 'partita', 64), ('mvp_voti', 'giocatore', 120),
      ('mvp_mese_voti', 'giocatore', 120),
      ('presenze', 'partita', 64), ('presenze', 'settore', 40),
      ('trasferte', 'partita', 64),
      ('trasferte_contatti', 'partita', 64),
      ('messaggi_live', 'partita', 64),
      ('segnalazioni', 'bersaglio', 120),
      ('dispositivi', 'token', 4096),
      ('profiles', 'settore', 40)
    ) as t(tabella, colonna, massimo)
  loop
    execute format('alter table %I drop constraint if exists %I', v.tabella, v.tabella || '_' || v.colonna || '_lunghezza');
    execute format(
      'alter table %I add constraint %I check (char_length(%I) <= %s) not valid',
      v.tabella, v.tabella || '_' || v.colonna || '_lunghezza', v.colonna, v.massimo
    );
  end loop;
end $$;
