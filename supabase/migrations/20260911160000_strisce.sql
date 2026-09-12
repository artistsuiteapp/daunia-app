-- Chi ne sta indovinando di fila.
--
-- PERCHE NON E UN CONTATORE SUL PROFILO
--
-- Una colonna `striscia` da tenere aggiornata si sfasa alla prima partita
-- rielaborata, e per rimetterla a posto bisognerebbe ricostruire la storia.
-- Qui la striscia si calcola dai pronostici e dai risultati, che sono i fatti:
-- e sempre giusta, anche dopo una correzione, e non c'e niente da mantenere.
--
-- COSA CONTA COME AZZECCATO
--
-- L'esito, non il risultato esatto. Chiedere il punteggio preciso per tre
-- partite di fila e una striscia che non fa nessuno, e una striscia che non fa
-- nessuno non e un premio: e una decorazione.
--
-- Le partite senza pronostico non rompono niente. Chi salta una giornata non
-- perde la striscia: non ha sbagliato, non ha giocato.

create or replace function strisce(quanti int default 5)
returns table (utente uuid, nome text, avatar text, striscia int, ultima timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with tentativi as (
    select
      pr.utente,
      pc.chiusa_il,
      (pr.casa = pc.casa and pr.ospiti = pc.ospiti)
        or esito_di(pr.casa, pr.ospiti) = esito_di(pc.casa, pc.ospiti) as azzeccato
    from pronostici pr
    join partite_chiuse pc on pc.partita = pr.partita
  ),
  ordinati as (
    -- dal piu recente: la striscia si conta all'indietro dall'ultima partita
    select utente, chiusa_il, azzeccato,
           row_number() over (partition by utente order by chiusa_il desc) as posto
    from tentativi
  ),
  conti as (
    select
      o.utente,
      -- il primo sbagliato partendo dal fondo interrompe; se non ce n'e
      -- nessuno, la striscia e tutta la storia di quella persona
      coalesce(
        (select min(x.posto) from ordinati x where x.utente = o.utente and not x.azzeccato) - 1,
        (select count(*) from ordinati x where x.utente = o.utente)
      )::int as striscia,
      max(o.chiusa_il) as ultima
    from ordinati o
    group by o.utente
  )
  select c.utente, p.nome, p.avatar, c.striscia, c.ultima
  from conti c
  join profiles p on p.id = c.utente
  where c.striscia > 0
  order by c.striscia desc, c.ultima desc
  limit greatest(quanti, 1);
$$;

/** La propria striscia, per il profilo. */
create or replace function mia_striscia()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select striscia from strisce(1000) where utente = auth.uid()), 0);
$$;
