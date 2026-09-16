-- Il tabellone a mano.
--
-- IL PROBLEMA CHE RISOLVE
--
-- Le fonti dal vivo hanno un ritardo che non dipende da noi. Il 15 settembre,
-- Foggia-Savoia: il punteggio arrivava con qualche minuto di ritardo e le
-- formazioni con cinquanta. Chi e allo stadio, o davanti alla partita, sa
-- tutto prima di qualsiasi fonte.
--
-- Quindi: quando un amministratore sta seguendo la partita, comanda lui. Segna
-- il gol, sceglie il marcatore dalla rosa, lo annulla se l'arbitro lo annulla,
-- scrive i minuti di recupero. Tutto finisce nella stessa riga che l'app gia
-- legge con Realtime, quindi compare su tutti i telefoni senza aggiornare
-- niente.
--
-- COME CONVIVE COL GUARDIANO
--
-- `manuale` acceso vuol dire: il guardiano continua a leggere le fonti, a
-- scrivere minuto, stato, cartellini e cambi, e a mandare le notifiche -- ma
-- non tocca piu punteggio e cronaca dei gol. Quelli sono dell'amministratore
-- finche non spegne. La colonna sta sulla riga della partita, quindi la
-- partita dopo riparte da sola: non si puo dimenticare acceso.
--
-- `manuale_base` e il punteggio da cui si parte: i gol a mano si contano sopra
-- quello. Cosi annullarne uno rifa il conto invece di fidarsi di una
-- sottrazione.

alter table stato_partita
  add column if not exists manuale      boolean not null default false,
  add column if not exists manuale_il   timestamptz,
  add column if not exists manuale_base jsonb,
  -- i minuti di recupero annunciati dal quarto uomo: nessuna fonte li da
  add column if not exists recupero     smallint,
  -- i gol annullati, con dentro la voce com'era: l'app li mostra e il
  -- guardiano ci legge cosa deve ancora annunciare
  add column if not exists annullati    jsonb not null default '[]'::jsonb,
  -- quando si e guardata l'ultima volta la diretta scritta della testata, da
  -- cui arrivano le formazioni un'ora prima della Lega e i minuti di recupero
  add column if not exists diretta_il   timestamptz,
  /*
   * Quello che vedono le fonti, sempre, anche quando comanda il pannello.
   *
   * Serve a chi sta segnando a mano: se le fonti dicono 1-1 e sul tabellone
   * c'e 1-0, o e arrivato un gol che non ha visto o ne ha segnato uno di
   * troppo. Senza questo, acceso il tabellone a mano, non ci sarebbe piu
   * niente con cui confrontarsi.
   */
  add column if not exists casa_fonti   smallint,
  add column if not exists ospiti_fonti smallint;

/*
 * Il conto dei gol a mano, rifatto da capo.
 *
 * Si parte dal punteggio di quando si e acceso il tabellone e si scorrono le
 * voci in ordine: ogni gol dell'amministratore aggiunge uno al suo lato e si
 * porta dietro il punteggio di quel momento, che e quello che l'app scrive
 * nella cronaca. Le voci che vengono dalle fonti restano come sono.
 *
 * Rifare il conto invece di sommare e togliere e l'unico modo perche un gol
 * annullato al 67esimo sistemi anche i due che erano arrivati dopo.
 */
create or replace function conta_a_mano(p_gol jsonb, p_base jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  voce  jsonb;
  fuori jsonb := '[]'::jsonb;
  c int := coalesce((p_base->>'casa')::int, 0);
  o int := coalesce((p_base->>'ospiti')::int, 0);
begin
  for voce in select * from jsonb_array_elements(coalesce(p_gol, '[]'::jsonb)) loop
    if voce->>'fonte' = 'admin' then
      if voce->>'lato' = 'casa' then c := c + 1; else o := o + 1; end if;
      voce := voce || jsonb_build_object('casa', c, 'ospiti', o);
    end if;
    fuori := fuori || jsonb_build_array(voce);
  end loop;
  return jsonb_build_object('gol', fuori, 'casa', c, 'ospiti', o);
end $$;

/*
 * L'unica porta per scrivere sul tabellone dall'app.
 *
 * `stato_partita` non ha nessuna politica di scrittura: la riga la tocca solo
 * il guardiano, che ha il service role. Un UPDATE dal client non darebbe
 * errore, darebbe zero righe cambiate -- il tasto sembrerebbe funzionare e non
 * succederebbe niente. Questa funzione controlla il ruolo e solleva un errore
 * vero, come tutto il resto del pannello.
 *
 * Azioni: accendi, spegni, gol, annulla, punteggio, recupero, stato, fine.
 */
create or replace function tabellone_a_mano(
  p_partita text,
  p_azione  text,
  p_lato    text    default null,
  p_nostro  boolean default null,
  p_chi     text    default null,
  p_minuto  int     default null,
  p_casa    int     default null,
  p_ospiti  int     default null,
  p_voce    text    default null,
  p_valore  int     default null,
  p_stato   text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r         stato_partita%rowtype;
  v_base    jsonb;
  v_gol     jsonb;
  v_annull  jsonb;
  v_recup   smallint;
  v_stato   text;
  v_finita  timestamptz;
  conto     jsonb;
  voce      jsonb;
  tolta     jsonb := null;
  restano   jsonb := '[]'::jsonb;
  id_voce   text;
begin
  if not e_admin() then
    raise exception 'Il tabellone a mano è solo per gli amministratori.';
  end if;

  select * into r from stato_partita where partita = p_partita;
  if not found then
    raise exception 'Questa partita non è nel tabellone.';
  end if;

  -- A partita chiusa il risultato e gia stato pagato ai pronostici: non si
  -- sposta piu, nemmeno da qui.
  if r.finita_il is not null then
    raise exception 'La partita è chiusa: il risultato non si cambia più.';
  end if;

  if p_azione = 'spegni' then
    update stato_partita
      set manuale = false, aggiornato_il = now()
      where partita = p_partita;
    return jsonb_build_object('ok', true, 'manuale', false,
      'casa', r.casa, 'ospiti', r.ospiti);
  end if;

  -- Qualsiasi altra azione accende il tabellone: premere "gol" e gia dire che
  -- si sta seguendo la partita.
  v_base := coalesce(r.manuale_base,
    jsonb_build_object('casa', coalesce(r.casa, 0), 'ospiti', coalesce(r.ospiti, 0)));
  v_gol    := coalesce(r.gol, '[]'::jsonb);
  v_annull := coalesce(r.annullati, '[]'::jsonb);
  v_recup  := r.recupero;
  v_stato  := r.stato;
  v_finita := null;

  if p_azione = 'accendi' then
    null;

  elsif p_azione = 'gol' then
    if p_lato is null or p_lato not in ('casa', 'ospiti') then
      raise exception 'Gol di chi? Serve il lato del campo.';
    end if;
    -- l'identificativo serve solo a poterlo annullare dopo, e al guardiano per
    -- sapere quali gol ha gia annunciato
    id_voce := 'm' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text;
    v_gol := v_gol || jsonb_build_array(jsonb_build_object(
      'id',     id_voce,
      'minuto', case when p_minuto is null then null else p_minuto::text end,
      'chi',    nullif(btrim(coalesce(p_chi, '')), ''),
      'nostro', coalesce(p_nostro, false),
      'lato',   p_lato,
      'fonte',  'admin'
    ));

  elsif p_azione = 'annulla' then
    for voce in select * from jsonb_array_elements(v_gol) loop
      if tolta is null and (
           (p_voce is not null and voce->>'id' = p_voce)
        or (p_voce is null and p_minuto is not null
            and voce->>'minuto' = p_minuto::text
            -- le voci che vengono dalle fonti non hanno un lato scritto:
            -- per quelle basta il minuto
            and (p_lato is null or voce->>'lato' is null or voce->>'lato' = p_lato))
      ) then
        tolta := voce;
      else
        restano := restano || jsonb_build_array(voce);
      end if;
    end loop;
    if tolta is null then
      raise exception 'Quel gol non è più nel tabellone.';
    end if;
    v_gol := restano;
    /*
     * Un gol che veniva dalle fonti non sta nel conto dei gol a mano: per
     * toglierlo davvero bisogna abbassare la base, altrimenti il punteggio
     * resterebbe quello di prima.
     */
    if coalesce(tolta->>'fonte', '') <> 'admin' and p_lato in ('casa', 'ospiti') then
      v_base := v_base || jsonb_build_object(
        p_lato, greatest(coalesce((v_base->>p_lato)::int, 0) - 1, 0));
    end if;
    v_annull := v_annull || jsonb_build_array(tolta || jsonb_build_object(
      'id', coalesce(tolta->>'id', 'a' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text),
      'lato', coalesce(tolta->>'lato', p_lato)
    ));

  elsif p_azione = 'punteggio' then
    if p_casa is null or p_ospiti is null then
      raise exception 'Serve il punteggio intero, tutti e due i numeri.';
    end if;
    -- si sposta la base, cosi il conto dei gol gia segnati resta buono
    conto := conta_a_mano(v_gol, jsonb_build_object('casa', 0, 'ospiti', 0));
    v_base := jsonb_build_object(
      'casa',   greatest(p_casa   - (conto->>'casa')::int, 0),
      'ospiti', greatest(p_ospiti - (conto->>'ospiti')::int, 0));

  elsif p_azione = 'recupero' then
    v_recup := case when p_valore is null then null else least(greatest(p_valore, 0), 30)::smallint end;

  elsif p_azione = 'stato' then
    if p_stato not in ('NS', '1H', 'HT', '2H', 'ET', 'FT') then
      raise exception 'Fase di gioco sconosciuta.';
    end if;
    v_stato := p_stato;
    if p_stato in ('1H', '2H') then v_recup := null; end if;

  elsif p_azione = 'fine' then
    v_stato  := 'FT';
    v_recup  := null;
    v_finita := now();

  else
    raise exception 'Azione sconosciuta.';
  end if;

  conto := conta_a_mano(v_gol, v_base);

  update stato_partita set
    manuale       = true,
    manuale_il    = coalesce(manuale_il, now()),
    manuale_base  = v_base,
    gol           = conto->'gol',
    casa          = (conto->>'casa')::smallint,
    ospiti        = (conto->>'ospiti')::smallint,
    annullati     = v_annull,
    recupero      = v_recup,
    stato         = v_stato,
    finita_il     = coalesce(v_finita, finita_il),
    aggiornato_il = now()
  where partita = p_partita;

  /*
   * Si sveglia il guardiano subito.
   *
   * Non per il punteggio -- quello e gia partito da solo con Realtime, nello
   * stesso istante -- ma per la notifica: e il guardiano che la manda, e senza
   * questa riga partirebbe al giro dopo, fino a venti secondi piu tardi. Se la
   * sveglia non riesce non succede niente di grave: parte al giro dopo.
   */
  begin
    perform sveglia_guardiano();
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'manuale', true,
    'casa', (conto->>'casa')::int,
    'ospiti', (conto->>'ospiti')::int,
    'recupero', v_recup,
    'stato', v_stato,
    'gol', conto->'gol',
    'annullati', v_annull);
end $$;

revoke execute on function tabellone_a_mano(text, text, text, boolean, text, int, int, int, text, int, text) from public, anon;
grant  execute on function tabellone_a_mano(text, text, text, boolean, text, int, int, int, text, int, text) to authenticated;
