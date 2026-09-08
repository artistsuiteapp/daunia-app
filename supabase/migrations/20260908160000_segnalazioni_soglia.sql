-- Segnalazioni: una a testa, e sparizione automatica oltre la soglia.
--
-- TRE COSE, DI CUI UNA E UN ERRORE DA CORREGGERE
--
-- 1. `bersaglio` era `uuid`. Le trasferte non hanno un id singolo: la riga e
--    identificata da (partita, utente), quindi l'app manda "partita:utente".
--    Ogni segnalazione su una trasferta sarebbe stata rifiutata dal tipo di
--    colonna, con un errore generico in faccia a chi la mandava. Diventa testo.
--
-- 2. Una segnalazione per persona per contenuto. Senza, chiunque puo premere
--    dieci volte e far sparire quello che gli sta antipatico.
--
-- 3. Oltre la soglia il contenuto si nasconde da solo, in attesa di revisione.
--
-- PERCHE LA SPARIZIONE AUTOMATICA, E PERCHE FA ANCHE PAURA
--
-- Chi gestisce l'app e una persona sola. Fra l'insulto scritto alle due di
-- notte e il momento in cui qualcuno lo legge possono passare otto ore, e in
-- quelle otto ore il danno e gia fatto.
--
-- Il prezzo e evidente e va detto: tre persone d'accordo possono zittire
-- chiunque. In una tifoseria succedera. Per questo la sparizione NON e una
-- condanna: e una sospensiva. Il contenuto resta nel database, un moderatore
-- lo rivede e lo rimette in chiaro con un tocco, e le segnalazioni respinte
-- restano scritte accanto a chi le ha mandate.
--
-- La soglia sta in una funzione da sola: si cambia in un punto quando si vedra
-- come si comporta la gente vera, che e l'unico modo per saperlo.

-- ------------------------------------------------ il bersaglio non e un uuid

alter table segnalazioni alter column bersaglio type text using bersaglio::text;

-- --------------------------------------------------- una segnalazione a testa

-- prima si tolgono i doppioni gia presenti, altrimenti l'indice non nasce
delete from segnalazioni s using segnalazioni piu_vecchia
where s.segnalante is not null
  and s.segnalante = piu_vecchia.segnalante
  and s.tipo = piu_vecchia.tipo
  and s.bersaglio = piu_vecchia.bersaglio
  and s.creata_il > piu_vecchia.creata_il;

create unique index if not exists segnalazioni_una_a_testa
  on segnalazioni (segnalante, tipo, bersaglio)
  where segnalante is not null;

-- ------------------------------------------------------------- la soglia

/**
 * Quante persone diverse servono perche un contenuto si nasconda da solo.
 *
 * Tre e un compromesso, non una verita. Con una tifoseria di poche decine di
 * iscritti tre amici bastano a mettere a tacere qualcuno; con qualche migliaio
 * tre e troppo poco per fermare una cosa grave. Si rivede guardando i numeri
 * veri, ed e per questo che sta qui e non sparsa in mezzo al codice.
 */
create or replace function soglia_segnalazioni()
returns integer
language sql
immutable
as $$ select 3 $$;

/*
 * Nasconde il contenuto quando abbastanza persone diverse l'hanno segnalato.
 *
 * Conta i segnalanti distinti, non le segnalazioni: l'indice qui sopra gia
 * impedisce il doppione, ma contare le persone rende la regola vera anche se
 * un giorno l'indice cambia.
 *
 * Le segnalazioni gia respinte da un moderatore non contano piu. Senza questa
 * riga, un contenuto assolto verrebbe rinascosto dalle stesse segnalazioni al
 * primo che ne aggiunge una, e il moderatore si ritroverebbe a rifare lo stesso
 * lavoro all'infinito.
 */
create or replace function nascondi_oltre_soglia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quanti integer;
begin
  select count(distinct segnalante) into quanti
  from segnalazioni
  where tipo = new.tipo and bersaglio = new.bersaglio and stato <> 'respinta';

  if quanti < soglia_segnalazioni() then
    return new;
  end if;

  if new.tipo = 'discussione' then
    update discussioni set nascosta = true where id = new.bersaglio::uuid;
  elsif new.tipo = 'risposta' then
    update risposte set nascosta = true where id = new.bersaglio::uuid;
  elsif new.tipo = 'messaggio' then
    update messaggi_live set nascosto = true where id = new.bersaglio::uuid;
  end if;
  -- trasferte e profili non si nascondono da soli: una riga "vado a Monopoli"
  -- non fa danno mentre aspetta, e un profilo intero e una decisione da persona

  return new;
end;
$$;

drop trigger if exists soglia_nasconde on segnalazioni;
create trigger soglia_nasconde after insert on segnalazioni
  for each row execute function nascondi_oltre_soglia();

-- --------------------------------------------- quello che vede chi modera

/**
 * La coda: una riga per contenuto segnalato, non per segnalazione.
 *
 * Un messaggio con sei segnalazioni deve occupare una riga sola, altrimenti la
 * coda diventa illeggibile proprio quando serve di piu.
 */
create or replace function coda_segnalazioni()
returns table (
  tipo        text,
  bersaglio   text,
  quante      bigint,
  motivi      text[],
  prima_il    timestamptz,
  ultima_il   timestamptz,
  stato       text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.tipo,
    s.bersaglio,
    count(*) as quante,
    array_agg(s.motivo order by s.creata_il desc) as motivi,
    min(s.creata_il) as prima_il,
    max(s.creata_il) as ultima_il,
    case when bool_or(s.stato = 'aperta') then 'aperta' else max(s.stato) end as stato
  from segnalazioni s
  where e_moderatore()
  group by s.tipo, s.bersaglio
  order by bool_or(s.stato = 'aperta') desc, max(s.creata_il) desc;
$$;

/** Chiude tutte le segnalazioni su un contenuto, e rimette in chiaro se respinte. */
create or replace function chiudi_segnalazioni(p_tipo text, p_bersaglio text, p_esito text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_moderatore() then
    raise exception 'serve il ruolo di moderatore';
  end if;
  if p_esito not in ('accolta', 'respinta') then
    raise exception 'esito non valido';
  end if;

  update segnalazioni
     set stato = p_esito, gestita_il = now(), gestita_da = auth.uid()
   where tipo = p_tipo and bersaglio = p_bersaglio and stato = 'aperta';

  -- respinta significa che il contenuto era a posto: torna visibile
  if p_esito = 'respinta' then
    if p_tipo = 'discussione' then
      update discussioni set nascosta = false where id = p_bersaglio::uuid;
    elsif p_tipo = 'risposta' then
      update risposte set nascosta = false where id = p_bersaglio::uuid;
    elsif p_tipo = 'messaggio' then
      update messaggi_live set nascosto = false where id = p_bersaglio::uuid;
    end if;
  else
    if p_tipo = 'discussione' then
      update discussioni set nascosta = true where id = p_bersaglio::uuid;
    elsif p_tipo = 'risposta' then
      update risposte set nascosta = true where id = p_bersaglio::uuid;
    elsif p_tipo = 'messaggio' then
      update messaggi_live set nascosto = true where id = p_bersaglio::uuid;
    end if;
  end if;
end;
$$;

/**
 * Il testo di un contenuto segnalato, per chi modera.
 *
 * Serve perche la coda mostri cosa si sta giudicando: decidere su un id e
 * impossibile. Passa solo a chi ha il ruolo, e legge anche il nascosto —
 * altrimenti dopo la sparizione automatica il moderatore non potrebbe piu
 * vedere quello che deve rivedere.
 */
create or replace function testo_segnalato(p_tipo text, p_bersaglio text)
returns table (autore uuid, nome text, testo text, quando timestamptz, nascosto boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_moderatore() then
    return;
  end if;

  if p_tipo = 'discussione' then
    return query
      select d.autore, p.nome, d.titolo || E'\n' || d.testo, d.creata_il, d.nascosta
      from discussioni d join profiles p on p.id = d.autore
      where d.id = p_bersaglio::uuid;
  elsif p_tipo = 'risposta' then
    return query
      select r.autore, p.nome, r.testo, r.creata_il, r.nascosta
      from risposte r join profiles p on p.id = r.autore
      where r.id = p_bersaglio::uuid;
  elsif p_tipo = 'messaggio' then
    return query
      select m.utente, p.nome, m.testo, m.creato_il, m.nascosto
      from messaggi_live m join profiles p on p.id = m.utente
      where m.id = p_bersaglio::uuid;
  elsif p_tipo = 'trasferta' then
    return query
      select t.utente, p.nome,
             t.citta || ' · ' || t.mezzo || coalesce(E'\n' || t.nota, ''),
             t.creato_il, false
      from trasferte t join profiles p on p.id = t.utente
      where t.partita = split_part(p_bersaglio, ':', 1)
        and t.utente = split_part(p_bersaglio, ':', 2)::uuid;
  end if;
end;
$$;
