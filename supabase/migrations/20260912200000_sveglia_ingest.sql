-- Chi sveglia l'aggiornamento dei dati.
--
-- IL PROBLEMA CHE RISOLVE
--
-- I dati (calendario, classifica, rosa, rassegna stampa) li scarica un lavoro
-- su GitHub Actions, e finora a chiamarlo era il cron di GitHub. Quel cron non
-- e affidabile, e non e un'opinione: sabato 6 settembre, giorno di partita, la
-- riga `*/10 12-22 * * 6,0` avrebbe dovuto produrre una sessantina di giri
-- nella fascia del pomeriggio. Ne ha prodotti cinque. Anche il ritmo di fondo
-- ogni sei ore arriva con ritardi di tre o quattro ore.
--
-- GitHub lo scrive nella sua documentazione: i lavori a orario sono "best
-- effort" e vengono rimandati o lasciati cadere quando la coda e piena. Su un
-- repository pubblico e gratuito la coda e sempre piena.
--
-- Il risultato per chi usa l'app: una testata pubblica un pezzo alle 13:24 e
-- nell'app si vede a sera, oppure il giorno dopo.
--
-- LA SOLUZIONE
--
-- pg_cron qui dentro gira gia ogni minuto per il guardiano della partita, e
-- non ha mai saltato un giro. Quindi l'orologio buono ce l'abbiamo: si usa
-- questo per bussare a GitHub, invece di aspettare che GitHub si ricordi.
--
-- I cron di GitHub restano dove sono, come rete di sicurezza: se questa
-- funzione smette, i dati si aggiornano lo stesso, solo piu tardi.
--
-- IL GETTONE
--
-- Non sta qui e non deve starci: questa migrazione finisce in un repository
-- pubblico. Sta in Vault, e la funzione lo legge al momento.
-- Si crea una volta sola, dalla console SQL di Supabase:
--   select vault.create_secret('<gettone>', 'github_gettone', 'PAT per svegliare l''ingest');
--
-- Il gettone e un "fine-grained personal access token" con UN SOLO permesso,
-- Actions: read and write, e su UN SOLO repository, artistsuiteapp/daunia-app.
-- Non puo leggere il codice di altri repository ne toccare nient'altro.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function sveglia_ingest()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  gettone text;
begin
  select decrypted_secret into gettone
  from vault.decrypted_secrets
  where name = 'github_gettone';

  -- Senza gettone non si chiama niente. Non e un guasto: finche non lo si
  -- crea, valgono i cron di GitHub come prima.
  if gettone is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://api.github.com/repos/artistsuiteapp/daunia-app/actions/workflows/ingest.yml/dispatches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'daunia-sveglia',
      'Authorization', 'Bearer ' || gettone
    ),
    body := jsonb_build_object('ref', 'main'),
    timeout_milliseconds := 20000
  );
end $$;

-- La funzione ha il gettone in mano: non la chiama nessuno dal client.
revoke execute on function sveglia_ingest() from public;
revoke execute on function sveglia_ingest() from anon;
revoke execute on function sveglia_ingest() from authenticated;

-- Ogni venti minuti, e nient'altro.
--
-- Non serve piu spesso: la rassegna stampa ha un freno suo a tre ore e
-- Wikipedia non cambia al minuto. Quello che DEVE essere al secondo -- il
-- punteggio, i gol, le formazioni, le notifiche -- non passa di qua: lo fa il
-- guardiano, che gira ogni minuto e non dipende da GitHub.
--
-- Venti minuti sono 72 giri al giorno. Un giro senza novita dura mezzo minuto
-- e su un repository pubblico i minuti sono gratis.
select cron.schedule('sveglia-ingest', '*/20 * * * *', 'select sveglia_ingest()');
