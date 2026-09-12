/*
 * Le misure: quante persone usano l'app, e quante tornano.
 *
 * PERCHE NON UNO STRUMENTO GIA PRONTO
 *
 * Plausible, Umami e simili sono script per il web: dentro l'app installata dal
 * telefono non girano, e fra una settimana l'app va sugli store. Un secondo
 * strumento solo per il telefono vorrebbe dire due conteggi diversi che non
 * tornano mai.
 *
 * In piu ogni pezzo di terzi va dichiarato nelle etichette privacy di Apple e
 * nel modulo Data Safety di Google, che sono due moduli da compilare la
 * settimana prossima. Tenere il conto in casa toglie una voce da tutti e due.
 *
 * COSA SI RACCOGLIE, E COSA NO
 *
 * Un identificativo casuale dell'installazione, il nome di quello che e
 * successo, e quando. Basta. Niente nome, niente email, niente identificativo
 * dell'account: da qui non si risale a una persona nemmeno volendo, e infatti
 * la colonna per farlo non esiste.
 *
 * L'elenco dei nomi ammessi e un vincolo della tabella, non una convenzione:
 * chi trovasse questo indirizzo non puo riempirlo di roba a piacere.
 */

create table if not exists eventi (
  id            bigserial primary key,
  installazione uuid not null,
  evento        text not null check (evento in (
                  'apertura', 'pronostico', 'pagella', 'migliore',
                  'curva_scritto', 'iscritto', 'condiviso'
                )),
  -- l'identificativo di una partita quando serve. Mai testo libero di nessuno.
  dettaglio     text check (dettaglio is null or char_length(dettaglio) <= 60),
  piattaforma   text not null check (piattaforma in ('web', 'ios', 'android')),
  creato_il     timestamptz not null default now()
);

create index if not exists eventi_per_giorno on eventi (creato_il desc);
create index if not exists eventi_per_installazione on eventi (installazione, creato_il);

alter table eventi enable row level security;

-- Scrivere si puo anche senza account: le persone che guardano e basta sono
-- quelle che piu interessa contare.
drop policy if exists "chiunque segna un evento" on eventi;
create policy "chiunque segna un evento"
  on eventi for insert to anon, authenticated with check (true);

-- Leggere no: sono numeri di gestione.
drop policy if exists "i numeri li legge chi modera" on eventi;
create policy "i numeri li legge chi modera"
  on eventi for select using (e_moderatore());

/*
 * I numeri, in una riga sola.
 *
 * "Attive" vuol dire installazioni diverse che hanno fatto almeno una cosa nel
 * periodo, non aperture: chi apre l'app sei volte al giorno conta uno.
 *
 * L'attivazione e la percentuale di chi, dopo aver aperto, ha messo almeno un
 * pronostico. E la soglia scelta prima di guardare i dati: chi pronostica ha
 * un motivo per tornare sabato, chi guarda e basta no.
 */
create or replace function numeri_app()
returns table (
  attive_oggi     int,
  attive_7        int,
  attive_30       int,
  nuove_7         int,
  pronostici_7    int,
  pagelle_7       int,
  scritti_7       int,
  iscritti_30     int,
  attivazione     numeric,
  ritorno_7       numeric,
  ritorno_30      numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_moderatore() then
    raise exception 'serve il ruolo di moderatore';
  end if;

  return query
  with prima_volta as (
    select installazione, min(creato_il) as inizio
    from eventi group by installazione
  ),
  -- chi e arrivato da almeno 7 (o 30) giorni: solo su questi ha senso chiedersi
  -- se sono tornati. Chi si e iscritto ieri non puo ancora avere un ritorno a 7
  -- giorni, e contarlo fra i mancati ritorni fa sembrare l'app peggiore di com'e.
  coorte_7 as (
    select p.installazione from prima_volta p
    where p.inizio < now() - interval '7 days'
  ),
  coorte_30 as (
    select p.installazione from prima_volta p
    where p.inizio < now() - interval '30 days'
  ),
  tornati_7 as (
    select distinct e.installazione
    from eventi e join prima_volta p on p.installazione = e.installazione
    where e.installazione in (select installazione from coorte_7)
      and e.creato_il >= p.inizio + interval '7 days'
  ),
  tornati_30 as (
    select distinct e.installazione
    from eventi e join prima_volta p on p.installazione = e.installazione
    where e.installazione in (select installazione from coorte_30)
      and e.creato_il >= p.inizio + interval '30 days'
  ),
  aperto as (
    select distinct installazione from eventi where evento = 'apertura'
  ),
  pronosticato as (
    select distinct installazione from eventi where evento = 'pronostico'
  )
  select
    (select count(distinct installazione)::int from eventi where creato_il >= date_trunc('day', now())),
    (select count(distinct installazione)::int from eventi where creato_il >= now() - interval '7 days'),
    (select count(distinct installazione)::int from eventi where creato_il >= now() - interval '30 days'),
    (select count(*)::int from prima_volta where inizio >= now() - interval '7 days'),
    (select count(*)::int from eventi where evento = 'pronostico' and creato_il >= now() - interval '7 days'),
    (select count(*)::int from eventi where evento = 'pagella' and creato_il >= now() - interval '7 days'),
    (select count(*)::int from eventi where evento = 'curva_scritto' and creato_il >= now() - interval '7 days'),
    (select count(*)::int from eventi where evento = 'iscritto' and creato_il >= now() - interval '30 days'),
    (select case when (select count(*) from aperto) = 0 then 0
                 else round(100.0 * (select count(*) from pronosticato) / (select count(*) from aperto), 1) end),
    (select case when (select count(*) from coorte_7) = 0 then null
                 else round(100.0 * (select count(*) from tornati_7) / (select count(*) from coorte_7), 1) end),
    (select case when (select count(*) from coorte_30) = 0 then null
                 else round(100.0 * (select count(*) from tornati_30) / (select count(*) from coorte_30), 1) end);
end;
$$;

revoke execute on function numeri_app() from public, anon;
grant execute on function numeri_app() to authenticated;

/*
 * Tredici mesi e poi si buttano.
 *
 * Servono a confrontare una stagione con quella prima. Tenerli oltre non serve
 * a niente e vorrebbe dire conservare dati che non si guardano piu.
 */
create or replace function pulisci_eventi()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare tolti int;
begin
  delete from eventi where creato_il < now() - interval '13 months';
  get diagnostics tolti = row_count;
  return tolti;
end;
$$;

revoke execute on function pulisci_eventi() from public, anon, authenticated;
