-- Chiusure trovate dal controllo di sicurezza di Supabase.
--
-- 1. La vista medie_voti girava con i permessi di chi l'ha creata. Serviva, e
--    voluto (le medie devono vedere tutti i voti, che singolarmente sono
--    privati), ma una vista di quel tipo aggira la sicurezza per riga anche
--    dove non vorresti, per esempio se un domani ci si aggiunge una join.
--    Diventa una funzione: fa la stessa cosa, ma l'ambito e ristretto a quello
--    che dichiara e i permessi si danno uno per uno.
--
-- 2. Le due funzioni dei trigger erano richiamabili da chiunque come chiamata
--    remota. Non servono a nessuno se non ai trigger che le usano, quindi il
--    permesso di eseguirle si toglie.

-- --------------------------------------------------- medie dei voti

drop view if exists medie_voti;

create or replace function medie_voti(p_partita text)
returns table (giocatore text, media numeric, quanti int)
language sql
security definer
set search_path = public
stable
as $$
  select v.giocatore,
         round(avg(v.voto)::numeric, 1) as media,
         count(*)::int as quanti
  from voti v
  where v.partita = p_partita
  group by v.giocatore
$$;

-- la puo chiamare chiunque: restituisce solo aggregati, mai un voto singolo
revoke all on function medie_voti(text) from public;
grant execute on function medie_voti(text) to anon, authenticated;

-- ------------------------------------- funzioni dei trigger non richiamabili

revoke all on function crea_profilo() from public, anon, authenticated;
revoke all on function tocca_discussione() from public, anon, authenticated;
