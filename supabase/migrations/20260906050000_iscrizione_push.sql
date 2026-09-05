-- Iscrizione alle notifiche, attraverso una funzione invece che con un upsert.
--
-- IL DIFETTO CHE QUESTA MIGRAZIONE RIPARA
--
-- Il client usava `upsert` sulla tabella. Un upsert e un INSERT ... ON CONFLICT
-- DO UPDATE, e PostgREST per risolvere il conflitto ha bisogno anche del
-- permesso di lettura. Sulla tabella la lettura e negata di proposito: le
-- chiavi di cifratura di un'iscrizione non devono poter uscire, altrimenti
-- chiunque potrebbe leggersi quelle degli altri.
--
-- Risultato: l'iscrizione falliva con "new row violates row-level security
-- policy", e in silenzio, perche l'app controllava solo se il browser si era
-- iscritto, non se la riga era arrivata.
--
-- La strada giusta e questa: una funzione che fa il lavoro dentro il database.
-- Il client passa i dati, non tocca la tabella, e non serve nessuna lettura.

create or replace function iscrivi_notifiche(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_preferenze jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_endpoint is null or p_p256dh is null or p_auth is null then
    raise exception 'iscrizione incompleta';
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

-- La usano tutti, ospiti compresi: le notifiche dei gol non sono un premio per
-- chi si registra, sono il motivo per cui uno torna.
grant execute on function iscrivi_notifiche(text, text, text, jsonb) to anon, authenticated;

-- Cambiare le preferenze conoscendo il proprio endpoint: stesso ragionamento.
create or replace function preferenze_notifiche(p_endpoint text, p_preferenze jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update push_iscrizioni
     set preferenze = p_preferenze, visto_il = now()
   where endpoint = p_endpoint;
end $$;

grant execute on function preferenze_notifiche(text, jsonb) to anon, authenticated;
