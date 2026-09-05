-- La Formazione della Curva.
--
-- Le formazioni ufficiali escono verso un'ora dal fischio d'inizio: prima non
-- esistono da nessuna parte. Per sei giorni su sette "chi deve giocare" non ha
-- una risposta pubblica, e questa tabella e la risposta che danno i tifosi.

create table if not exists formazioni_curva (
  utente     uuid not null references profiles on delete cascade,
  partita    text not null,
  giocatori  text[] not null check (cardinality(giocatori) = 11),
  creato_il  timestamptz not null default now(),
  primary key (utente, partita)
);

alter table formazioni_curva enable row level security;

-- Come per i pronostici: la formazione di un altro si legge solo a partita
-- finita. Prima basterebbe guardare quella di chi ci prende sempre per copiarla.
-- Il dato d'insieme, invece, si vede subito: quello e il senso della funzione,
-- e passa dalla funzione qui sotto, non da questa tabella.
drop policy if exists "la propria formazione sempre, quelle altrui a partita finita" on formazioni_curva;
create policy "la propria formazione sempre, quelle altrui a partita finita"
  on formazioni_curva for select
  using (auth.uid() = utente or exists (
    select 1 from partite_chiuse p where p.partita = formazioni_curva.partita
  ));

drop policy if exists "ognuno schiera la propria formazione" on formazioni_curva;
create policy "ognuno schiera la propria formazione"
  on formazioni_curva for all
  using (auth.uid() = utente) with check (auth.uid() = utente);

-- L'undici della curva, in forma aggregata.
--
-- Torna quante volte ogni giocatore e stato schierato e quanti tifosi hanno
-- votato in tutto, mai chi ha votato cosa. E security definer perche deve
-- leggere righe che le policy qui sopra tengono nascoste: e il modo di dare il
-- dato d'insieme senza aprire quelli personali.
create or replace function undici_curva(p_partita text)
returns table (giocatore text, voti bigint, votanti bigint)
language sql
security definer
set search_path = public
stable
as $$
  with righe as (
    select utente, array(select distinct u from unnest(giocatori) u) as scelti
    from formazioni_curva
    where partita = p_partita
  ),
  totale as (select count(*)::bigint as n from righe)
  select nome as giocatore, count(*)::bigint as voti, (select n from totale) as votanti
  from righe, unnest(righe.scelti) as nome
  group by nome
  order by voti desc, nome;
$$;

revoke execute on function undici_curva(text) from public;
grant execute on function undici_curva(text) to anon, authenticated;
