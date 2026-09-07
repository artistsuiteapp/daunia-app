-- Il migliore della partita e il migliore del mese.
--
-- I voti ci sono gia in `voti`, ma si leggono solo una partita alla volta:
-- per sapere chi ha convinto di piu in una gara, o in un mese intero,
-- toccava scaricarli tutti e contare nell'app. Con centinaia di voti non
-- regge, e i voti singoli devono restare privati.
--
-- Queste due funzioni contano nel database e restituiscono solo le medie,
-- come fa gia `medie_voti`.

/**
 * Il migliore di una partita.
 *
 * Serve un numero minimo di voti, altrimenti il primo che vota decide da
 * solo: un 10 isolato batterebbe un 7.5 dato da trenta persone.
 */
create or replace function migliore_partita(p_partita text, p_minimo int default 3)
returns table (giocatore text, media numeric, quanti int)
language sql
security definer
set search_path = public
stable
as $$
  select giocatore, round(avg(voto)::numeric, 2) as media, count(*)::int as quanti
  from voti
  where partita = p_partita
  group by giocatore
  having count(*) >= p_minimo
  order by avg(voto) desc, count(*) desc
  limit 1;
$$;

/**
 * Il migliore del mese.
 *
 * Le partite le passa chi chiama, invece di filtrare per data: `voti` sa
 * quando e stato dato il voto, non quando si e giocato, e uno che vota
 * lunedi la partita di domenica scorsa finirebbe nel mese sbagliato. Gli id
 * delle partite di un mese li conosce l'app, che ha il calendario.
 *
 * Si contano tutti i voti, non le medie delle singole gare: chi gioca di piu
 * pesa di piu, ed e giusto -- un fuoriclasse per una partita sola non e il
 * migliore del mese.
 *
 * Il minimo e piu alto che per la singola partita: con pochi voti in croce
 * il risultato sarebbe casuale.
 */
create or replace function migliore_mese(p_partite text[], p_minimo int default 10)
returns table (giocatore text, media numeric, quanti int, partite int)
language sql
security definer
set search_path = public
stable
as $$
  select
    v.giocatore,
    round(avg(v.voto)::numeric, 2) as media,
    count(*)::int as quanti,
    count(distinct v.partita)::int as partite
  from voti v
  where v.partita = any(p_partite)
  group by v.giocatore
  having count(*) >= p_minimo
  order by avg(v.voto) desc, count(*) desc
  limit 5;
$$;

revoke all on function migliore_partita(text, int) from public;
revoke all on function migliore_mese(text[], int) from public;
grant execute on function migliore_partita(text, int) to anon, authenticated;
grant execute on function migliore_mese(text[], int) to anon, authenticated;
