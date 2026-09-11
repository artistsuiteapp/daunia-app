-- Le parolacce si coprono, il messaggio passa.
--
-- PERCHE SI CAMBIA
--
-- Finora il trigger rifiutava la scrittura. Sembra la scelta severa ed e la
-- piu debole: chi ha scritto non sa quale parola ha fatto scattare il filtro,
-- riprova, sbaglia di nuovo, e alla terza volta smette di scrivere. In una
-- chat che dura novanta minuti si perde la persona, non la parolaccia.
--
-- Adesso la riga entra sempre e la parola si copre: resta la prima lettera, il
-- resto diventa asterischi. Nel database finisce il testo gia coperto, mai
-- l'originale con una bandierina: quello che non si vuole pubblicare non si
-- conserva nemmeno.
--
-- La copia in apps/mobile/lib/filtro-core.ts fa la stessa cosa con la stessa
-- regola, cosi chi scrive vede subito come viene. Questa resta quella che
-- decide: un controllo nell'app si aggira chiamando l'API con la chiave
-- anonima, questo no.

/* ---------------------------------------------------------- parole nuove */

-- Aggiunte nostre: quelle che mancavano e la famiglia foggiana e napoletana
-- di "ki te mu ort", nelle forme piu comuni. Le storpiature che nessuno ha
-- previsto le prende la regola piu sotto.
insert into parole_vietate (parola) values
  ('bastarda'), ('cornuta'), ('cornuti'), ('cornuto'),
  ('curnut'), ('curnuta'), ('curnuto'),
  ('fetent'), ('fetente'), ('fetenti'),
  ('mignottona'), ('mignottone'),
  ('ntamam'), ('ntamamm'), ('ntammamm'),
  ('puttanaccio'), ('ricchiona'), ('ricchione'),
  ('strunz'), ('strunza'), ('strunzo'),
  ('zoccolaccia'), ('zoccole'), ('zoccolona'), ('zoccolone'),
  ('chitemmuort'), ('chitemort'), ('chitemu'), ('chitemuort'), ('chitemurt'),
  ('ketemuort'), ('kitemmuort'), ('kitemort'), ('kitemu'), ('kitemuort'),
  ('kitemuorte'), ('kitemuorto'), ('kitemuortt'), ('kitemurt'),
  ('kitestramu'), ('kitestramuort'), ('kitestramurt')
on conflict (parola) do nothing;

/* ------------------------------------------------------ la regola dialettale */

-- "Ki te mu ort" si scrive in venti modi e un elenco fisso li perde quasi
-- tutti. La forma pero e sempre la stessa: ki/chi + te + (stra) + m + u/o + rt.
--
-- Due regole, e la differenza e dove si possono guardare. La prima vale su una
-- parola sola e parte dall'inizio: senza l'ancora prenderebbe dentro parole
-- italiane vere, "recitemmo" contiene "citemmo" e non c'entra niente. La
-- seconda gira su tutto il testo attaccato, per chi spezza la parola, ma
-- pretende "uort" per intero e cosi non tocca nessuno.
create or replace function e_dialetto_offensivo(parola text)
returns boolean
language sql
immutable
as $$
  select coalesce(parola ~ '^(k|c)h?ite(stra)?m+[uo]+r?t*', false);
$$;

create or replace function contiene_dialetto_spezzato(t text)
returns boolean
language sql
immutable
as $$
  select replace(normalizza_testo(t), ' ', '') ~ '(k|c)h?ite(stra)?m+uort';
$$;

/* ------------------------------------------------ bestemmie: qualifiche in piu */

create or replace function qualifiche_offensive()
returns text[]
language sql
immutable
as $$
  select array['porco','porca','porcu','porc','cane','cana','can','boia',
               'ladro','ladra','maiale','maial','bestia','bastardo','bastarda',
               'stronzo','stronza','merda','merdoso','puttana','putana','troia',
               'schifoso','schifosa','zozzo','zozza','lurido','lurida','sporco',
               'sporca','infame','cornuto','impestato','marcio','fottuto',
               'zoccola','mignotta','strunzo','strunz','fetente','fetent',
               'curnut','pezzente','sfondato','ubriaco','porcaccio','porcaccia'];
$$;

create or replace function nomi_divini()
returns text[]
language sql
immutable
as $$
  select array['dio','ddio','iddio','dii','madonna','madona','madonnina',
               'cristo','cristoddio','gesu','gesucristo','sacramento','sacramentodio'];
$$;

create or replace function contiene_bestemmia(t text)
returns text
language plpgsql
immutable
as $$
declare
  nomi text[] := nomi_divini();
  qualifiche text[] := qualifiche_offensive();
  norm text;
  parole text[];
  unito text;
  i int;
  n text;
  q text;
begin
  norm := normalizza_testo(t);
  if norm = '' then return null; end if;

  parole := string_to_array(norm, ' ');
  unito := replace(norm, ' ', '');

  for i in 1 .. array_length(parole, 1) - 1 loop
    if (parole[i] = any(nomi) and parole[i+1] = any(qualifiche))
       or (parole[i] = any(qualifiche) and parole[i+1] = any(nomi)) then
      return parole[i] || ' ' || parole[i+1];
    end if;
  end loop;

  foreach n in array nomi loop
    if position(n in unito) = 0 then continue; end if;
    foreach q in array qualifiche loop
      if position(n || q in unito) > 0 or position(q || n in unito) > 0 then
        return n || '+' || q;
      end if;
    end loop;
  end loop;

  return null;
end $$;

-- La parolaccia adesso comprende anche la famiglia dialettale.
create or replace function contiene_parolaccia(t text)
returns text
language sql
stable
as $$
  select p
  from unnest(string_to_array(normalizza_testo(t), ' ')) as p
  where p <> ''
    and (p in (select parola from parole_vietate) or e_dialetto_offensivo(p))
  limit 1;
$$;

/* --------------------------------------------------------- l'oscuramento */

/** Una parola coperta: resta la prima lettera, il resto diventa asterischi. */
create or replace function oscura_parola(parola text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(length(parola), 0) <= 1 then '*'
    else left(parola, 1) || repeat('*', length(parola) - 1)
  end;
$$;

/*
 * Copre quello che non deve comparire e lascia il resto com'era.
 *
 * Le parole si cercano sul testo ORIGINALE, non su quello normalizzato: la
 * normalizzazione toglie accenti, cambia i numeri in lettere e comprime le
 * ripetizioni, quindi le posizioni non tornano piu e non si saprebbe piu quale
 * pezzo del testo vero coprire. Si tagliano prima le parole dov'erano, poi
 * ognuna si normalizza per conto suo.
 *
 * Tre passaggi, dal piu preciso al piu grosso:
 *  1. due parole di seguito che fanno una bestemmia -- si coprono tutte e due
 *  2. una parola sola: parolaccia, bestemmia attaccata, o dialetto
 *  3. se dopo i primi due la bestemmia c'e ancora, e stata scritta spezzata
 *     ("d i o p o r c o") e non esiste una parola da coprire: li si copre
 *     tutto. Capita di rado e chi ci arriva lo ha fatto apposta.
 */
create or replace function maschera_testo(t text)
returns text
language plpgsql
stable
as $$
declare
  nomi text[] := nomi_divini();
  qualifiche text[] := qualifiche_offensive();
  parole text[] := '{}';
  norme text[] := '{}';
  coperta boolean[] := '{}';
  trovata text;
  i int;
  n text;
  q text;
  quante int;
  cursore int := 1;
  posizione int;
  fuori text := '';
  vietate text[];
begin
  if t is null or t = '' then return t; end if;

  select array_agg(m[1] order by ordinalita)
    into parole
    from regexp_matches(t, '[[:alnum:]@$]+', 'g') with ordinality as r(m, ordinalita);

  if parole is null then return t; end if;
  quante := array_length(parole, 1);

  for i in 1 .. quante loop
    norme := norme || replace(normalizza_testo(parole[i]), ' ', '');
    coperta := coperta || false;
  end loop;

  select array_agg(parola) into vietate from parole_vietate;

  -- 1. la coppia su due parole
  for i in 1 .. quante - 1 loop
    if (norme[i] = any(nomi) and norme[i+1] = any(qualifiche))
       or (norme[i] = any(qualifiche) and norme[i+1] = any(nomi)) then
      coperta[i] := true;
      coperta[i+1] := true;
    end if;
  end loop;

  -- 2. la parola singola
  for i in 1 .. quante loop
    if coperta[i] or norme[i] = '' then continue; end if;
    if norme[i] = any(vietate) or e_dialetto_offensivo(norme[i]) then
      coperta[i] := true;
      continue;
    end if;
    foreach n in array nomi loop
      if position(n in norme[i]) = 0 then continue; end if;
      foreach q in array qualifiche loop
        if position(n || q in norme[i]) > 0 or position(q || n in norme[i]) > 0 then
          coperta[i] := true;
          exit;
        end if;
      end loop;
      exit when coperta[i];
    end loop;
  end loop;

  -- ricomposizione: si cammina sul testo vero, parola per parola, nell'ordine
  for i in 1 .. quante loop
    posizione := position(parole[i] in substr(t, cursore));
    -- non dovrebbe mai capitare: le parole vengono da questo stesso testo.
    -- Se capita si lascia la parola com'e, invece di tagliare a caso.
    if posizione = 0 then continue; end if;
    posizione := posizione + cursore - 1;
    if not coperta[i] then
      cursore := posizione + length(parole[i]);
      continue;
    end if;
    fuori := fuori || substr(t, cursore, posizione - cursore) || oscura_parola(parole[i]);
    cursore := posizione + length(parole[i]);
  end loop;
  fuori := fuori || substr(t, cursore);

  -- 3. scritta spezzata lettera per lettera: non c'e una parola da coprire
  trovata := contiene_bestemmia(fuori);
  if trovata is not null or contiene_dialetto_spezzato(fuori) then
    fuori := '';
    cursore := 1;
    for i in 1 .. quante loop
      posizione := position(parole[i] in substr(t, cursore));
      if posizione = 0 then continue; end if;
      posizione := posizione + cursore - 1;
      fuori := fuori || substr(t, cursore, posizione - cursore) || oscura_parola(parole[i]);
      cursore := posizione + length(parole[i]);
    end loop;
    fuori := fuori || substr(t, cursore);
  end if;

  return fuori;
end $$;

/* ------------------------------------------------------------- il trigger */

/*
 * Scrive nella riga il testo gia coperto.
 *
 * Si passa dalla riga convertita in jsonb per leggere colonne che su certe
 * tabelle non esistono. Si rimettono pero SOLO le colonne cambiate, non tutta
 * la riga: un giro completo attraverso jsonb toccherebbe anche date, uuid e
 * numeri che non c'entrano niente con le parolacce.
 */
create or replace function maschera_offese()
returns trigger
language plpgsql
as $$
declare
  riga jsonb := to_jsonb(new);
  cambi jsonb := '{}'::jsonb;
  campo text;
  prima text;
  dopo text;
begin
  foreach campo in array array['titolo','testo','corpo','messaggio','nota'] loop
    if not (riga ? campo) then continue; end if;
    prima := riga->>campo;
    if prima is null or prima = '' then continue; end if;
    dopo := maschera_testo(prima);
    if dopo is distinct from prima then
      cambi := jsonb_set(cambi, array[campo], to_jsonb(dopo));
    end if;
  end loop;

  if cambi <> '{}'::jsonb then
    new := jsonb_populate_record(new, cambi);
  end if;

  return new;
end $$;

/*
 * Il vecchio nome resta e copre anche lui.
 *
 * Le migrazioni gia applicate creano trigger che puntano a blocca_offese: se
 * qui lo si cancellasse, quelle tabelle resterebbero senza filtro. Riscritto
 * cosi, chi lo chiama ancora fa la cosa nuova.
 */
create or replace function blocca_offese()
returns trigger
language plpgsql
as $$
declare
  riga jsonb := to_jsonb(new);
  cambi jsonb := '{}'::jsonb;
  campo text;
  prima text;
  dopo text;
begin
  foreach campo in array array['titolo','testo','corpo','messaggio','nota'] loop
    if not (riga ? campo) then continue; end if;
    prima := riga->>campo;
    if prima is null or prima = '' then continue; end if;
    dopo := maschera_testo(prima);
    if dopo is distinct from prima then
      cambi := jsonb_set(cambi, array[campo], to_jsonb(dopo));
    end if;
  end loop;

  if cambi <> '{}'::jsonb then
    new := jsonb_populate_record(new, cambi);
  end if;

  return new;
end $$;

/*
 * I trigger si trovano da soli.
 *
 * Le tabelle con il filtro sono gia quattro e ne arriveranno altre: elencarle
 * a mano qui significa dimenticarne una la prossima volta. Si chiede a
 * Postgres chi ha il trigger vecchio e lo si sostituisce dov'e.
 */
do $$
declare
  r record;
begin
  for r in
    select tgrelid::regclass as tabella
    from pg_trigger
    where tgname = 'niente_offese' and not tgisinternal
  loop
    execute format('drop trigger if exists niente_offese on %s', r.tabella);
    execute format(
      'create trigger copri_offese before insert or update on %s
         for each row execute function maschera_offese()', r.tabella);
  end loop;
end $$;
