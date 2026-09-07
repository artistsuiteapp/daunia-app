-- MVP e migliore del mese: si sceglie un nome, non si danno voti.
--
-- Le prime funzioni li ricavavano dalle pagelle, facendo la media dei voti da
-- 4 a 10. Ma sono due cose diverse: la pagella e un giudizio su ognuno, l'MVP
-- e una scelta sola fra tutti. Uno puo dare 7 a tutta la squadra e pensare
-- comunque che il migliore sia stato il portiere, e con la media quel pensiero
-- non si vede.
--
-- Qui si conta chi ha preso piu preferenze, come un'elezione.

/** Una preferenza per partita, per persona. Cambiarla sostituisce la vecchia. */
create table if not exists mvp_voti (
  utente    uuid not null references profiles on delete cascade,
  partita   text not null,
  giocatore text not null,
  creato_il timestamptz not null default now(),
  primary key (utente, partita)
);

/** Una preferenza per mese, per persona. Il mese e "2026-09". */
create table if not exists mvp_mese_voti (
  utente    uuid not null references profiles on delete cascade,
  mese      text not null check (mese ~ '^\d{4}-\d{2}$'),
  giocatore text not null,
  creato_il timestamptz not null default now(),
  primary key (utente, mese)
);

alter table mvp_voti enable row level security;
alter table mvp_mese_voti enable row level security;

-- Come per le pagelle: ognuno vede e scrive solo il proprio. I totali passano
-- dalle funzioni qui sotto, cosi non si puo sapere chi ha votato chi.
drop policy if exists "il mio voto mvp" on mvp_voti;
create policy "il mio voto mvp" on mvp_voti
  for all using (auth.uid() = utente) with check (auth.uid() = utente);

drop policy if exists "il mio voto mvp del mese" on mvp_mese_voti;
create policy "il mio voto mvp del mese" on mvp_mese_voti
  for all using (auth.uid() = utente) with check (auth.uid() = utente);

/**
 * Chi ha vinto una partita, per preferenze.
 *
 * Torna la classifica intera, non solo il primo: serve a mostrare quanto e
 * stato combattuto, e con due nomi appaiati dire "ha vinto lui" sarebbe una
 * forzatura.
 */
create or replace function mvp_partita(p_partita text)
returns table (giocatore text, voti int)
language sql
security definer
set search_path = public
stable
as $$
  select giocatore, count(*)::int as voti
  from mvp_voti
  where partita = p_partita
  group by giocatore
  order by count(*) desc, giocatore
  limit 11;
$$;

/** Chi ha vinto il mese, per preferenze. */
create or replace function mvp_mese(p_mese text)
returns table (giocatore text, voti int)
language sql
security definer
set search_path = public
stable
as $$
  select giocatore, count(*)::int as voti
  from mvp_mese_voti
  where mese = p_mese
  group by giocatore
  order by count(*) desc, giocatore
  limit 11;
$$;

revoke all on function mvp_partita(text) from public;
revoke all on function mvp_mese(text) from public;
grant execute on function mvp_partita(text) to anon, authenticated;
grant execute on function mvp_mese(text) to anon, authenticated;
