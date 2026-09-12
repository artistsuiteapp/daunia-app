/*
 * Il pronostico si chiude al fischio d'inizio. Davvero.
 *
 * L'app lo scriveva in tre posti diversi ("si chiude al fischio d'inizio") e
 * nessuno lo faceva rispettare: chiunque, anche a partita finita, poteva
 * mandare una riga con il risultato giusto e prendersi cento punti. Bastava
 * l'app aperta su una schermata vecchia, senza nemmeno volerlo fare apposta.
 *
 * Il controllo sta nel database e non nell'app perche l'app la si puo
 * scavalcare: la chiave pubblica sta dentro la pagina, per definizione.
 *
 * SI SBAGLIA DALLA PARTE GIUSTA
 *
 * Se del calcio d'inizio non si sa niente -- riga assente, oppure presente ma
 * senza orario -- passa. Meglio accettare un pronostico in piu che rifiutarli
 * tutti la domenica pomeriggio per una riga che il guardiano non ha ancora
 * scritto.
 */
create or replace function pronostico_prima_del_fischio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inizio timestamptz;
  finita timestamptz;
begin
  select s.kickoff, s.finita_il
    into inizio, finita
    from stato_partita s
   where s.partita = new.partita;

  if finita is not null or (inizio is not null and now() >= inizio) then
    raise exception 'la partita e gia cominciata: i pronostici si chiudono al fischio d''inizio';
  end if;

  return new;
end;
$$;

drop trigger if exists pronostico_chiuso on pronostici;
create trigger pronostico_chiuso before insert or update on pronostici
  for each row execute function pronostico_prima_del_fischio();
