/*
 * Due cose: chi puo vedere chi e collegato, e chi puo sospendere davvero.
 */

-- ============================================================ 1. la presenza

/*
 * IL PROBLEMA
 *
 * L'elenco di chi e collegato viaggiava su un canale aperto. Aperto vuol dire
 * che bastava la chiave pubblica dell'app -- che sta dentro la pagina, per
 * come e fatto il sistema -- per mettersi in ascolto senza account e ricevere,
 * in diretta, nome e identificativo di ogni persona che sta usando l'app, piu
 * l'ora in cui si e collegata e quella in cui se n'e andata.
 *
 * Chi ascolta non deve nemmeno annunciarsi, quindi resta invisibile anche a
 * chi modera. I nomi erano gia pubblici in giro per l'app; quello che non
 * doveva uscire e "chi c'e adesso", che l'app promette di non conservare.
 *
 * LA CORREZIONE
 *
 * Il canale diventa privato, e su un canale privato Postgres decide chi puo
 * entrare. Qui possono entrare solo le persone con un account. Chi non ha
 * fatto l'accesso non riceve piu niente.
 *
 * Perche non "solo chi modera": per comparire nell'elenco bisogna anche poter
 * entrare nel canale. Se entrassero solo i moderatori, non ci sarebbe nessun
 * altro da vedere e l'elenco sarebbe sempre vuoto.
 *
 * Queste regole valgono SOLO per i canali dichiarati privati: la chat della
 * partita e il punteggio dal vivo restano aperti come prima e non cambiano.
 */
drop policy if exists "presenza: la legge chi ha un account" on realtime.messages;
create policy "presenza: la legge chi ha un account"
  on realtime.messages for select
  to authenticated
  using (realtime.topic() = 'presenza');

drop policy if exists "presenza: si annuncia chi ha un account" on realtime.messages;
create policy "presenza: si annuncia chi ha un account"
  on realtime.messages for insert
  to authenticated
  with check (realtime.topic() = 'presenza');

-- ========================================================= 2. le sospensioni

/*
 * IL PROBLEMA
 *
 * `sospendi_utente` e `revoca_sospensione` scrivono su `profiles.sospeso_fino`,
 * ma su quella colonna c'e il trigger `ruolo_protetto`, che rifiuta qualsiasi
 * cambiamento se chi chiama non e admin. Il trigger vale anche per le funzioni
 * che scavalcano le politiche di lettura, perche guarda il ruolo del token e
 * quello non cambia.
 *
 * Risultato: un moderatore non poteva sospendere nessuno. Il tasto c'era, il
 * database rispondeva "il ruolo e la sospensione li assegna un amministratore",
 * e il ramo di `sospendi_utente` scritto apposta per i moderatori non e mai
 * servito a niente. Il mio test non se n'era accorto perche costruiva le
 * tabelle a mano e il trigger non c'era.
 *
 * LA CORREZIONE
 *
 * Il trigger resta e continua a fermare chiunque provi a scrivere quella
 * colonna dall'esterno. Le due funzioni, che i controlli li fanno gia e uno per
 * uno, alzano un contrassegno che vale solo per la loro transazione: il trigger
 * lo vede e le lascia passare. Un client non puo alzarlo per conto suo, perche
 * per farlo dovrebbe gia poter eseguire una funzione che non gli e concessa.
 */
create or replace function proteggi_ruolo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ruolo is distinct from old.ruolo or new.sospeso_fino is distinct from old.sospeso_fino then
    -- lasciato passare da imposta_ruolo / sospendi_utente / revoca_sospensione,
    -- che hanno gia controllato chi chiama e su chi
    if coalesce(current_setting('app.moderazione_vagliata', true), '') = 'si' then
      return new;
    end if;
    if auth.role() = 'authenticated' and not e_admin() then
      raise exception 'il ruolo e la sospensione li assegna un amministratore';
    end if;
  end if;
  return new;
end;
$$;

create or replace function imposta_ruolo(chi uuid, nuovo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  attuale text;
begin
  if not e_admin() then
    raise exception 'serve il ruolo di admin';
  end if;
  if chi = auth.uid() then
    raise exception 'il proprio ruolo non si cambia da qui';
  end if;
  if nuovo not in ('utente', 'moderatore', 'admin') then
    raise exception 'ruolo non valido';
  end if;

  select ruolo into attuale from profiles where id = chi;
  if attuale is null then
    raise exception 'persona non trovata';
  end if;
  if attuale = 'admin' then
    raise exception 'un admin non si tocca dal pannello';
  end if;

  perform set_config('app.moderazione_vagliata', 'si', true);
  update profiles set ruolo = nuovo where id = chi;
  perform set_config('app.moderazione_vagliata', '', true);
end;
$$;

create or replace function sospendi_utente(chi uuid, giorni int default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  fino timestamptz;
  attuale text;
begin
  if not e_moderatore() then
    raise exception 'serve il ruolo di moderatore';
  end if;
  if chi = auth.uid() then
    raise exception 'non puoi sospendere te stesso';
  end if;

  select ruolo into attuale from profiles where id = chi;
  if attuale is null then
    raise exception 'persona non trovata';
  end if;
  if attuale = 'admin' then
    raise exception 'un admin non si sospende dal pannello';
  end if;
  if attuale = 'moderatore' and not e_admin() then
    raise exception 'serve il ruolo di admin';
  end if;

  fino := case when giorni is null then 'infinity'::timestamptz
               else now() + make_interval(days => greatest(1, giorni)) end;

  perform set_config('app.moderazione_vagliata', 'si', true);
  update profiles set sospeso_fino = fino where id = chi;
  perform set_config('app.moderazione_vagliata', '', true);
  return fino;
end;
$$;

/*
 * Riammettere adesso ha gli stessi controlli del sospendere.
 *
 * Prima ne aveva uno solo -- "sei un moderatore" -- e non si vedeva perche il
 * trigger fermava tutto comunque. Tolto quell'inciampo, l'asimmetria diventa
 * vera: un moderatore potrebbe annullare il bando deciso da un admin. Qui i
 * controlli sono gli stessi da tutte e due le parti.
 */
create or replace function revoca_sospensione(chi uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  attuale text;
begin
  if not e_moderatore() then
    raise exception 'serve il ruolo di moderatore';
  end if;

  select ruolo into attuale from profiles where id = chi;
  if attuale is null then
    raise exception 'persona non trovata';
  end if;
  if attuale = 'moderatore' and not e_admin() then
    raise exception 'serve il ruolo di admin';
  end if;

  perform set_config('app.moderazione_vagliata', 'si', true);
  update profiles set sospeso_fino = null where id = chi;
  perform set_config('app.moderazione_vagliata', '', true);
end;
$$;
