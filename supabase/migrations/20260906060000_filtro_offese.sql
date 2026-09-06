-- Filtro contro parolacce e bestemmie, dentro il database.
--
-- PERCHE QUI E NON NELL'APP
--
-- Un filtro nel client e una tenda: chiunque puo chiamare direttamente l'API di
-- Supabase con la chiave anonima e scriverci quello che vuole. Il cancello deve
-- stare dove passano per forza tutti, cioe qui.
--
-- Nell'app ce n'e una copia (apps/mobile/lib/filtro-core.ts, sotto test) che
-- serve solo ad avvisare chi scrive prima che prema invia. Le due devono dire
-- la stessa cosa; questa e quella che decide.

create extension if not exists unaccent;

create table if not exists parole_vietate (
  parola text primary key
);

alter table parole_vietate enable row level security;
-- si legge da nessuno: non serve a nessun client, e un elenco di parolacce
-- scaricabile e solo un regalo a chi vuole aggirarlo

insert into parole_vietate (parola) values
  ('abcdiet'),
  ('affanculo'),
  ('anabootcampdiet'),
  ('bagasce'),
  ('bagascia'),
  ('bagascione'),
  ('baldracca'),
  ('baldraccacce'),
  ('baldraccaccia'),
  ('baldracche'),
  ('baldraccona'),
  ('baldraccone'),
  ('bariledimerda'),
  ('bastardacce'),
  ('bastardacci'),
  ('bastardaccia'),
  ('bastardaccio'),
  ('bastardamadonna'),
  ('bastarde'),
  ('bastardi'),
  ('bastardo'),
  ('bastardona'),
  ('bastardone'),
  ('bastardoni'),
  ('battona'),
  ('battone'),
  ('bbwpit'),
  ('bocchinara'),
  ('bocchinare'),
  ('bocchinari'),
  ('bocchinaro'),
  ('budellodidio'),
  ('bustadipiscio'),
  ('cacaminchia'),
  ('cacare'),
  ('cacasotto'),
  ('cagacazzo'),
  ('cagaminchia'),
  ('cagare'),
  ('cagasotto'),
  ('canacciodidio'),
  ('canagliadidio'),
  ('canedallah'),
  ('canedeva'),
  ('canedidio'),
  ('cazzacci'),
  ('cazzaccio'),
  ('cazzata'),
  ('cazzate'),
  ('cazzetti'),
  ('cazzetto'),
  ('cazzi'),
  ('cazzissimo'),
  ('cazzo'),
  ('cazzona'),
  ('cazzone'),
  ('cazzoni'),
  ('cazzuta'),
  ('cazzute'),
  ('cazzuti'),
  ('cazzutissimo'),
  ('cazzuto'),
  ('cesso'),
  ('checca'),
  ('checche'),
  ('chiavare'),
  ('chiavata'),
  ('chiavate'),
  ('chiavatona'),
  ('chiavatone'),
  ('ciucciamelo'),
  ('ciucciapalle'),
  ('cogliona'),
  ('coglionaggine'),
  ('coglionare'),
  ('coglionata'),
  ('coglionate'),
  ('coglionatore'),
  ('coglionatrice'),
  ('coglionatura'),
  ('coglionature'),
  ('coglionazzi'),
  ('coglionazzo'),
  ('coglioncelli'),
  ('coglioncello'),
  ('coglioncini'),
  ('coglioncino'),
  ('coglione'),
  ('coglioneria'),
  ('coglionerie'),
  ('coglioni'),
  ('coprofago'),
  ('coprofilo'),
  ('cornutoilpapa'),
  ('credoana'),
  ('cretinetti'),
  ('cristodecapitato'),
  ('cristodundio'),
  ('cristoincroce'),
  ('culattone'),
  ('culattoni'),
  ('culi'),
  ('culo'),
  ('culona'),
  ('culone'),
  ('deficiente'),
  ('dietaabc'),
  ('dietaana'),
  ('dietaanabootcamp'),
  ('dietabootcamp'),
  ('dietadellabc'),
  ('diobastardo'),
  ('diobestia'),
  ('diobestiazza'),
  ('dioboia'),
  ('diocan'),
  ('diocane'),
  ('diocannaiolo'),
  ('diocapra'),
  ('diocoglione'),
  ('diocomunista'),
  ('diocrasto'),
  ('diocristo'),
  ('dioculattone'),
  ('diofarabutto'),
  ('diofascista'),
  ('diofinocchio'),
  ('dioflagellato'),
  ('dioimpestato'),
  ('dioimpiccato'),
  ('dioladro'),
  ('diolebbroso'),
  ('diolobotomizzato'),
  ('diolurido'),
  ('diomaiale'),
  ('diomaledetto'),
  ('diomerda'),
  ('diominchione'),
  ('dionegro'),
  ('dioporco'),
  ('diopoveraccio'),
  ('diopovero'),
  ('diorotto'),
  ('diorottoinculo'),
  ('diorutto'),
  ('diosbudellato'),
  ('dioschifoso'),
  ('dioseppellito'),
  ('dioserpente'),
  ('diostracane'),
  ('diostramerda'),
  ('diostronzo'),
  ('diosventrato'),
  ('dioverme'),
  ('facciadaculo'),
  ('facciadimerda'),
  ('fanculo'),
  ('fica'),
  ('ficata'),
  ('ficate'),
  ('fichetta'),
  ('fichette'),
  ('fichetti'),
  ('fichetto'),
  ('ficona'),
  ('ficone'),
  ('figa'),
  ('figata'),
  ('figate'),
  ('fighe'),
  ('fighetta'),
  ('fighette'),
  ('fighetti'),
  ('fighetto'),
  ('figliadicane'),
  ('figliadimignotta'),
  ('figliadiputtana'),
  ('figliaditroia'),
  ('figlidicani'),
  ('figlidimignotta'),
  ('figlidiputtana'),
  ('figliditroia'),
  ('figliedicani'),
  ('figliedimignotta'),
  ('figliediputtana'),
  ('figlieditroia'),
  ('figliodicane'),
  ('figliodimignotta'),
  ('figliodiputtana'),
  ('figlioditroia'),
  ('figona'),
  ('figone'),
  ('figoni'),
  ('fottere'),
  ('fottiti'),
  ('fottuta'),
  ('fottute'),
  ('fottuti'),
  ('fottutissima'),
  ('fottutissime'),
  ('fottutissimi'),
  ('fottutissimo'),
  ('fottuto'),
  ('fregna'),
  ('frocetto'),
  ('froci'),
  ('frociara'),
  ('frociaro'),
  ('frociarola'),
  ('frociarolo'),
  ('frocio'),
  ('frocione'),
  ('frocioni'),
  ('frocissimo'),
  ('gesùcristaccio'),
  ('gesùesorcizzato'),
  ('gesùhandicappato'),
  ('gesùimpasticcato'),
  ('gesùmalandato'),
  ('gesùradioattivo'),
  ('gesùsieropositivo'),
  ('gesùstordito'),
  ('gesùzozzo'),
  ('incazzare'),
  ('incazzata'),
  ('incazzate'),
  ('incazzati'),
  ('incazzatissima'),
  ('incazzatissime'),
  ('incazzatissimi'),
  ('incazzatissimo'),
  ('incazzato'),
  ('inculare'),
  ('inculata'),
  ('inculate'),
  ('infrociato'),
  ('leccacazzi'),
  ('leccaculi'),
  ('leccaculo'),
  ('leccafica'),
  ('leccafiga'),
  ('leccafighe'),
  ('leccapalle'),
  ('madonnaassassinata'),
  ('madonnacane'),
  ('madonnaimpestata'),
  ('madonnaisterica'),
  ('madonnalurida'),
  ('madonnamaiala'),
  ('madonnamongoloide'),
  ('madonnanegra'),
  ('madonnaputtana'),
  ('madonnaschiava'),
  ('madonnastregaccia'),
  ('madonnasudicia'),
  ('madonnasuicida'),
  ('madonnasurgelata'),
  ('madonnatroia'),
  ('madonnaviolentata'),
  ('mannaggiacristo'),
  ('mannaggiadio'),
  ('mannaggiailbattesimo'),
  ('mannaggiailclero'),
  ('mannaggiaisanti'),
  ('mannaggialabibbia'),
  ('mannaggialadiocesi'),
  ('mannaggialamadonna'),
  ('mannaggialaputtana'),
  ('mannaggialarcangelo'),
  ('mannaggiapadrepio'),
  ('mannaggiasangiuseppe'),
  ('merda'),
  ('merdacce'),
  ('merdaccia'),
  ('merdamalcagata'),
  ('merdata'),
  ('merdate'),
  ('merde'),
  ('merdina'),
  ('merdine'),
  ('merdolina'),
  ('merdoline'),
  ('merdona'),
  ('merdone'),
  ('merdosa'),
  ('merdose'),
  ('merdosi'),
  ('merdoso'),
  ('mezzasega'),
  ('mezzeseghe'),
  ('mignotta'),
  ('mignotte'),
  ('minchia'),
  ('minchiadura'),
  ('minchiaduro'),
  ('minchiata'),
  ('minchiate'),
  ('minchie'),
  ('minchione'),
  ('minchioni'),
  ('mona'),
  ('mongoloide'),
  ('negra'),
  ('negraccia'),
  ('negraccio'),
  ('negro'),
  ('negrona'),
  ('negrone'),
  ('nerchia'),
  ('patonza'),
  ('patonze'),
  ('pigliacazzi'),
  ('pisciare'),
  ('pisciasotto'),
  ('pisciata'),
  ('pisciatina'),
  ('pisciato'),
  ('pisciatona'),
  ('piscio'),
  ('pisciona'),
  ('piscione'),
  ('piscioni'),
  ('pompinara'),
  ('pompinare'),
  ('pompini'),
  ('pompino'),
  ('porcamadonna'),
  ('porcaputtana'),
  ('porcodidio'),
  ('porcodio'),
  ('porcoilclero'),
  ('porcoilsignore'),
  ('proana'),
  ('proanoressia'),
  ('probulimia'),
  ('proed'),
  ('proednos'),
  ('promia'),
  ('pugnetta'),
  ('pugnette'),
  ('puppa'),
  ('puppamela'),
  ('puppamelo'),
  ('puppare'),
  ('puppe'),
  ('puttana'),
  ('puttanacce'),
  ('puttanaccia'),
  ('puttanaeva'),
  ('puttanamadonna'),
  ('puttanata'),
  ('puttanate'),
  ('puttane'),
  ('puttanella'),
  ('puttanelle'),
  ('puttaniere'),
  ('puttanieri'),
  ('puttano'),
  ('puttanona'),
  ('puttanone'),
  ('raspone'),
  ('rasponi'),
  ('ricchione'),
  ('ricchioni'),
  ('rincoglionito'),
  ('rizzacazzi'),
  ('rompicazzi'),
  ('rompicazzo'),
  ('rompicoglioni'),
  ('rottinculo'),
  ('sbocchinare'),
  ('sbocchinato'),
  ('sbocchiniamolo'),
  ('sborra'),
  ('sborrare'),
  ('sborrata'),
  ('sborrate'),
  ('sborrato'),
  ('sborratona'),
  ('sburra'),
  ('sburrare'),
  ('scassacazzo'),
  ('scassacoglioni'),
  ('scassaminchia'),
  ('scazzare'),
  ('scazzata'),
  ('scazzate'),
  ('scazzati'),
  ('scazzato'),
  ('scopare'),
  ('scopata'),
  ('scopate'),
  ('segaiolo'),
  ('signorebastardo'),
  ('spompinare'),
  ('spompinata'),
  ('spompinato'),
  ('spompiniamolo'),
  ('stronzata'),
  ('stronzate'),
  ('stronzetta'),
  ('stronzette'),
  ('stronzetti'),
  ('stronzetto'),
  ('stronzina'),
  ('stronzine'),
  ('stronzini'),
  ('stronzino'),
  ('stronzo'),
  ('stronzoli'),
  ('stronzolo'),
  ('stronzomalcagato'),
  ('stronzona'),
  ('stronzone'),
  ('stronzoni'),
  ('succhiacazzi'),
  ('succhiamelo'),
  ('succhiaminchia'),
  ('succhiapalle'),
  ('tarzanelli'),
  ('tarzanello'),
  ('tetta'),
  ('tette'),
  ('tettina'),
  ('tettine'),
  ('tettona'),
  ('tettone'),
  ('thinspiration'),
  ('thinspo'),
  ('troia'),
  ('troiacce'),
  ('troiaccia'),
  ('troiamadonna'),
  ('troie'),
  ('troietta'),
  ('troiette'),
  ('troio'),
  ('troiona'),
  ('troioncella'),
  ('troioncelle'),
  ('troione'),
  ('trombare'),
  ('trombata'),
  ('trombatona'),
  ('vaccamadonna'),
  ('vaffanculo'),
  ('zinne'),
  ('zoccola')
on conflict (parola) do nothing;

/*
 * Riduce il testo alla forma su cui si cerca: minuscole, accenti tolti, numeri
 * riportati a lettere, lettere ripetute tre o piu volte compresse a una, tutto
 * il resto diventa spazio.
 *
 * Il punto esclamativo NON diventa una i: nella scrittura vera e punteggiatura
 * molto piu spesso che sostituzione.
 */
create or replace function normalizza_testo(t text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        translate(lower(unaccent(coalesce(t, ''))), '0134578@$', 'oieastbga s'),
        '([a-z])\1{2,}', '\1', 'g'
      ),
      '[^a-z]+', ' ', 'g'
    ),
    ' +', ' ', 'g'
  ));
$$;

/*
 * Le bestemmie non sono una lista: sono combinatorie, nome divino piu qualifica
 * offensiva. Una lista fissa si aggira cambiando una lettera.
 *
 * La coppia deve essere ATTACCATA: due parole di seguito, oppure unite senza
 * niente in mezzo. Basta una parolina fra le due e non scatta. Cosi "il cane di
 * Dio" e "la diocesi di Foggia" passano, che e quello che conta di piu.
 */
create or replace function contiene_bestemmia(t text)
returns text
language plpgsql
immutable
as $$
declare
  nomi text[] := array['dio','ddio','iddio','dii','madonna','madona','madonnina',
                       'cristo','cristoddio','gesu','gesucristo','sacramento','sacramentodio'];
  qualifiche text[] := array['porco','porca','porcu','porc','cane','cana','can','boia',
                             'ladro','ladra','maiale','maial','bestia','bastardo','bastarda',
                             'stronzo','stronza','merda','merdoso','puttana','putana','troia',
                             'schifoso','schifosa','zozzo','zozza','lurido','lurida','sporco',
                             'sporca','infame','cornuto','impestato','marcio','fottuto'];
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

  -- due parole di seguito
  for i in 1 .. array_length(parole, 1) - 1 loop
    if (parole[i] = any(nomi) and parole[i+1] = any(qualifiche))
       or (parole[i] = any(qualifiche) and parole[i+1] = any(nomi)) then
      return parole[i] || ' ' || parole[i+1];
    end if;
  end loop;

  -- tutto attaccato, anche scritto spaziato lettera per lettera
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

/*
 * Parolacce: solo parole intere. Cercarle dentro le altre bloccherebbe parole
 * innocenti che se le portano dentro per caso ("scazzottata"), e un filtro che
 * punisce chi non ha fatto niente si fa odiare in fretta.
 */
create or replace function contiene_parolaccia(t text)
returns text
language sql
stable
as $$
  select p.parola
  from parole_vietate p
  where p.parola = any(string_to_array(normalizza_testo(t), ' '))
  limit 1;
$$;

/* Il guardiano che sta davanti alle scritture. */
create or replace function blocca_offese()
returns trigger
language plpgsql
as $$
declare
  testo text;
  trovato text;
begin
  testo := concat_ws(' ',
    case when to_jsonb(new) ? 'titolo' then new.titolo end,
    case when to_jsonb(new) ? 'corpo' then new.corpo end,
    case when to_jsonb(new) ? 'testo' then new.testo end
  );

  trovato := contiene_bestemmia(testo);
  if trovato is not null then
    raise exception 'bestemmia' using errcode = 'check_violation',
      hint = 'Qui le bestemmie non passano. Riscrivi senza e il messaggio parte.';
  end if;

  trovato := contiene_parolaccia(testo);
  if trovato is not null then
    raise exception 'parolaccia' using errcode = 'check_violation',
      hint = 'C''e una parola che qui non passa. Riscrivi e il messaggio parte.';
  end if;

  return new;
end $$;

drop trigger if exists niente_offese on discussioni;
create trigger niente_offese before insert or update on discussioni
  for each row execute function blocca_offese();

drop trigger if exists niente_offese on risposte;
create trigger niente_offese before insert or update on risposte
  for each row execute function blocca_offese();
