-- Due avvisi soli in piu, uno prima e uno dopo.
--
-- PERCHE SOLO DUE
--
-- Le notifiche di un'app di tifosi sono la cosa piu facile da sbagliare: al
-- terzo avviso inutile si toglie il permesso, e quello non torna piu. Quelle
-- che c'erano gia sono tutte fatti della partita -- formazioni, inizio, gol,
-- espulsione, intervallo, fine -- e queste due non sono un'eccezione: sono le
-- uniche due cose che riguardano quello che ha fatto la persona.
--
--   pronostico  un'ora prima, e SOLO a chi non l'ha ancora messo
--   esito       a partita chiusa, e SOLO a chi aveva pronosticato
--
-- Chi ha gia giocato non riceve il promemoria. Chi non ha giocato non riceve
-- il risultato. Sono due avvisi al massimo per partita, e mai a vuoto.

alter table stato_partita
  add column if not exists promemoria_mandato boolean not null default false;

alter table stato_partita
  add column if not exists esito_mandato boolean not null default false;

-- Il valore predefinito per chi si iscrive da adesso in poi.
alter table push_iscrizioni
  alter column preferenze set default
    '{"formazioni":true,"inizio":true,"gol":true,"espulsione":true,"intervallo":true,"fine":true,"pronostico":true,"esito":true}'::jsonb;

/*
 * Le iscrizioni che c'erano gia.
 *
 * Il guardiano sceglie chi avvisare con `preferenze->>'pronostico' = 'true'`:
 * una chiave che non c'e torna null, e null non e 'true'. Senza questo
 * riempimento i due avvisi nuovi non arriverebbero a nessuno di quelli gia
 * iscritti, e non ci sarebbe niente da guardare per capire perche.
 *
 * Si aggiungono solo le chiavi mancanti: chi ha gia spento qualcosa resta
 * spento.
 */
update push_iscrizioni
set preferenze = jsonb_build_object('pronostico', true, 'esito', true) || preferenze
where not (preferenze ? 'pronostico') or not (preferenze ? 'esito');
