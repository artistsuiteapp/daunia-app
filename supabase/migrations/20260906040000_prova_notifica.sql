-- Invio di prova, comandato dal database.
--
-- Prima stava in uno script che leggeva il segreto da Vault e lo passava a
-- curl, sminuzzando l'output della CLI di Supabase. Su un'altra macchina quel
-- formato e diverso e lo script si e rotto. Il segreto non deve uscire dal
-- database: cosi la prova e una riga di SQL e non c'e niente da interpretare.

create or replace function manda_prova()
returns text
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  segreto text;
  richiesta bigint;
begin
  select decrypted_secret into segreto
  from vault.decrypted_secrets
  where name = 'guardiano_segreto';

  if segreto is null then
    return 'segreto guardiano_segreto assente in Vault';
  end if;

  select net.http_post(
    url := 'https://idofdpaftnaoyvuplksq.supabase.co/functions/v1/guardiano-partita',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-guardiano', segreto
    ),
    body := '{"prova": true}'::jsonb,
    timeout_milliseconds := 20000
  ) into richiesta;

  return 'richiesta ' || richiesta || ' partita, guarda esito_prova()';
end $$;

-- La risposta di pg_net arriva dopo: questa la va a prendere.
create or replace function esito_prova()
returns table (stato integer, risposta text, quando timestamptz)
language sql
security definer
set search_path = public, extensions, net
stable
as $$
  select status_code, content, created
  from net._http_response
  order by created desc
  limit 1;
$$;

-- Nessuna delle due si chiama dal client: hanno il segreto in mano.
revoke execute on function manda_prova() from public, anon, authenticated;
revoke execute on function esito_prova() from public, anon, authenticated;
