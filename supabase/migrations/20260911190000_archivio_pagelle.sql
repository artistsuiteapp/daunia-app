-- L'archivio delle pagelle: una riga per partita, non una per giocatore.
--
-- PERCHE SERVE UNA FUNZIONE E NON BASTA LA VISTA
--
-- `medie_voti` da la media di ogni giocatore in una partita, ed e giusta per la
-- scheda di quella partita. Per l'elenco di tutte le partite giocate servirebbe
-- una chiamata per gara, e a fine stagione sono quaranta chiamate per disegnare
-- una lista. Qui si chiede una volta sola, passando gli id che l'app conosce.
--
-- COSA ESCE E COSA NON ESCE
--
-- Escono numeri contati: media della squadra, quante persone hanno votato,
-- quanti voti in tutto, e chi ha preso la media piu alta. Non esce mai un voto
-- singolo, come per il resto delle pagelle: chi ha dato 4 a chi resta suo.
--
-- Il migliore compare solo con almeno tre voti, la stessa soglia di
-- `migliore_partita`. Sotto, il primo che vota decide da solo.

create or replace function pagelle_riassunto(p_partite text[], p_minimo int default 3)
returns table (
  partita        text,
  media          numeric,
  votanti        int,
  voti           int,
  migliore       text,
  media_migliore numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with per_giocatore as (
    select v.partita, v.giocatore, avg(v.voto) as media, count(*)::int as quanti
    from voti v
    where v.partita = any(p_partite)
    group by v.partita, v.giocatore
  ),
  per_partita as (
    select v.partita,
           round(avg(v.voto)::numeric, 2) as media,
           count(distinct v.utente)::int as votanti,
           count(*)::int as voti
    from voti v
    where v.partita = any(p_partite)
    group by v.partita
  ),
  migliori as (
    -- distinct on tiene la prima riga di ogni partita nell'ordine qui sotto:
    -- media piu alta, poi piu voti, poi il nome, cosi un pari non balla
    select distinct on (g.partita)
           g.partita, g.giocatore, round(g.media::numeric, 2) as media_migliore
    from per_giocatore g
    where g.quanti >= p_minimo
    order by g.partita, g.media desc, g.quanti desc, g.giocatore
  )
  select p.partita, p.media, p.votanti, p.voti, m.giocatore, m.media_migliore
  from per_partita p
  left join migliori m on m.partita = p.partita;
$$;

revoke all on function pagelle_riassunto(text[], int) from public;
grant execute on function pagelle_riassunto(text[], int) to anon, authenticated;
