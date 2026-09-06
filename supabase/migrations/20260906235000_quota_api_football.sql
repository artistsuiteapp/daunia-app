-- Il contatore delle chiamate ad API-Football, con il freno.
--
-- Il 6 settembre il primo account e stato sospeso automaticamente: i loro
-- termini dicono che richieste "sproporzionate o eccessive" fanno scattare il
-- firewall, e il conto tornava -- sessantacinque chiamate del guardiano piu
-- quaranta dell'ingest, contro un tetto di cento al giorno.
--
-- Ridurre le pause non basta: e una stima, e una stima sbagliata costa
-- l'account. Serve un contatore vero che sappia dire di no.
--
-- Il giorno e in UTC perche il reso di API-Football e a mezzanotte UTC.

create table if not exists quota_af (
  giorno date primary key,
  usate  integer not null default 0
);

alter table quota_af enable row level security;
-- nessuna policy: ci arriva solo il guardiano, che ha il service role

/**
 * Chiede il permesso di fare `quante` chiamate.
 *
 * Torna true solo se ci stanno tutte dentro il tetto, e in quel caso le ha
 * gia contate. E una transazione sola: due giri del guardiano nello stesso
 * istante non possono passare tutti e due l'ultimo posto disponibile.
 *
 * Il tetto lo decide chi chiama, non questa funzione: guardiano e ingest hanno
 * budget separati che sommati stanno sotto i cento.
 */
create or replace function chiedi_quota(quante integer, tetto integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  dopo integer;
begin
  insert into quota_af (giorno, usate)
  values ((now() at time zone 'utc')::date, quante)
  on conflict (giorno) do update
    set usate = quota_af.usate + quante
    where quota_af.usate + quante <= tetto
  returning usate into dopo;

  -- niente riga di ritorno = la clausola where ha rifiutato: tetto raggiunto
  return dopo is not null;
end $$;

/** Quante ne restano oggi, per guardare senza consumare. */
create or replace function quota_rimasta(tetto integer)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select greatest(0, tetto - coalesce(
    (select usate from quota_af where giorno = (now() at time zone 'utc')::date), 0));
$$;

revoke execute on function chiedi_quota(integer, integer) from public, anon, authenticated;
revoke execute on function quota_rimasta(integer) from public, anon, authenticated;
