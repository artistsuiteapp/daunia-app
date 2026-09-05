-- Chi sveglia il guardiano.
--
-- pg_cron lo chiama ogni minuto. Quasi sempre il guardiano si riaddormenta
-- subito: fuori dalla finestra di una partita esce senza interrogare nessuna
-- fonte, quindi un minuto di frequenza non costa niente nei giorni vuoti.
--
-- Il segreto che autentica la chiamata NON sta qui. Sta in Vault, e questa
-- funzione lo legge al momento: una migrazione finisce nel repository, e un
-- segreto in un repository e un segreto perso.
-- Si crea una volta sola, fuori da qui:
--   select vault.create_secret('<segreto>', 'guardiano_segreto', '...');

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function sveglia_guardiano()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  segreto text;
begin
  select decrypted_secret into segreto
  from vault.decrypted_secrets
  where name = 'guardiano_segreto';

  -- senza segreto non si chiama niente: meglio un cron muto che una chiamata
  -- che verrebbe rifiutata sessanta volte all'ora
  if segreto is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://idofdpaftnaoyvuplksq.supabase.co/functions/v1/guardiano-partita',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-guardiano', segreto
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end $$;

-- La funzione ha il segreto in mano: non la tocca nessuno dal client.
revoke execute on function sveglia_guardiano() from public;
revoke execute on function sveglia_guardiano() from anon;
revoke execute on function sveglia_guardiano() from authenticated;

select cron.schedule('guardiano-partita', '* * * * *', 'select sveglia_guardiano()');
