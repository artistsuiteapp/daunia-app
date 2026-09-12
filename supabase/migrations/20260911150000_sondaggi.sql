-- Sondaggi del Match Center.
--
-- I VOTI SINGOLI NON ESCONO MAI, ESCONO CONTATI
--
-- Come per le pagelle: sapere che Tizio ha votato "male" a "come sta giocando
-- il Foggia" non serve a nessuno, e in una chat di tifosi serve anche meno.
-- La tabella dei voti si legge solo per la propria riga; i totali passano da
-- una vista che conta e basta.
--
-- I punti li da la funzione, non il client: con la chiave anonima dentro
-- l'app, un punto che si puo scrivere e un punto che non vale niente.

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
 * Non c'e una risposta giusta da proteggere, e uno che cambia idea a caldo e
 * la cosa piu normale del mondo. I punti pero si danno una volta sola, perche
 * la chiave e il sondaggio.
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
