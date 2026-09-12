/*
 * Identita di chi scrive, e il pannello di chi amministra.
 *
 * DUE PROBLEMI CHE SI RISOLVONO INSIEME
 *
 * 1. In tutta l'app un nome e solo un nome: non si vede chi modera, non si vede
 *    chi gioca da tre mesi. Il ruolo sta gia su `profiles` ed e leggibile da
 *    chiunque; i punti no, e per mostrarli accanto a un nome servirebbe una
 *    chiamata per persona. Qui c'e una lettura sola per schermata.
 *
 * 2. Un admin, dall'app, non puo fare niente. Le politiche gli permettono di
 *    cancellare e nascondere, ma non di toccare il profilo di un altro: la
 *    politica di UPDATE su `profiles` e `auth.uid() = id`, e basta. Quindi
 *    sospendere e promuovere passano da funzioni che controllano il ruolo,
 *    non da un UPDATE dal client che fallirebbe in silenzio.
 *
 * LA REGOLA DEI PUNTI NON CAMBIA
 *
 * I punti restano una somma di `punti_movimenti`, mai un contatore. Queste
 * funzioni leggono, nessuna scrive un punto.
 */

-- --------------------------------------------------- il totale di un altro no

/*
 * `punti_totali(chi)` era `security definer` senza controlli e senza revoca:
 * chiunque, anche senza account, poteva chiedere il totale di chiunque
 * passando un identificativo. Poco grave perche la classifica e pubblica, ma
 * una funzione che scavalca le politiche e non guarda chi chiama e un buco che
 * il giorno in cui si aggiunge un dato riservato diventa vero.
 *
 * Adesso serve solo per se stessi. Il totale di un altro si legge da
 * `profilo_pubblico`, che e il posto giusto perche dice esplicitamente che
 * quel dato e pubblico.
 */
create or replace function punti_totali(chi uuid default auth.uid())
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if chi is null or (chi <> auth.uid() and not e_moderatore()) then
    raise exception 'i punti di un altro si leggono da profilo_pubblico';
  end if;
  return coalesce((select sum(punti) from punti_movimenti where utente = chi), 0)::int;
end;
$$;

revoke execute on function punti_totali(uuid) from public, anon;
grant execute on function punti_totali(uuid) to authenticated;

-- ------------------------------------------------------- nome, ruolo e punti

/*
 * L'identita di un gruppo di persone in una chiamata sola.
 *
 * La alternativa era chiedere i punti uno per uno mentre si scorre una
 * discussione: venti nomi, venti chiamate. Si passa l'elenco degli
 * identificativi che compaiono nella schermata e torna tutto insieme.
 *
 * E pubblica come lo e la classifica: questi stessi punti si leggono gia da
 * `classifica()` senza account. Il livello non torna da qui perche le soglie
 * stanno anche nell'app e servono anche senza rete.
 */
create or replace function identita(p_utenti uuid[])
returns table (utente uuid, nome text, avatar text, ruolo text, punti int)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.nome,
         p.avatar,
         p.ruolo,
         coalesce((select sum(m.punti) from punti_movimenti m where m.utente = p.id), 0)::int
  from profiles p
  where p.id = any(p_utenti);
$$;

grant execute on function identita(uuid[]) to anon, authenticated;

/*
 * La scheda pubblica di una persona: quello che si vede toccando un nome.
 *
 * Niente email, niente data di nascita, niente di quello che ha scritto: nome,
 * foto, ruolo, punti, da quando c'e, e i badge presi. Sono le stesse cose che
 * gia si vedono in giro per l'app, messe in un posto solo.
 */
create or replace function profilo_pubblico(chi uuid)
returns table (
  utente     uuid,
  nome       text,
  avatar     text,
  bio        text,
  ruolo      text,
  punti      int,
  iscritto_il timestamptz,
  badge      jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.nome,
         p.avatar,
         p.bio,
         p.ruolo,
         coalesce((select sum(m.punti) from punti_movimenti m where m.utente = p.id), 0)::int,
         p.creato_il,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'codice', b.codice, 'nome', b.nome,
                    'icona', b.icona, 'presoIl', bu.preso_il)
                  order by bu.preso_il)
           from badge_utente bu join badge b on b.codice = bu.badge
           where bu.utente = p.id
         ), '[]'::jsonb)
  from profiles p
  where p.id = chi;
$$;

grant execute on function profilo_pubblico(uuid) to anon, authenticated;

-- ------------------------------------------------------------- il pannello

/*
 * L'elenco delle persone iscritte, per chi modera.
 *
 * Ordinato per ultima iscrizione, con la ricerca sul nome. Il numero di
 * segnalazioni ricevute sta qui dentro perche e la cosa che fa decidere: un
 * nome con otto segnalazioni aperte e la riga da guardare per prima.
 */
create or replace function elenco_utenti(p_cerca text default null, p_quanti int default 100)
returns table (
  utente       uuid,
  nome         text,
  avatar       text,
  ruolo        text,
  punti        int,
  sospeso_fino timestamptz,
  iscritto_il  timestamptz,
  segnalazioni int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_moderatore() then
    raise exception 'serve il ruolo di moderatore';
  end if;

  return query
    select p.id,
           p.nome,
           p.avatar,
           p.ruolo,
           coalesce((select sum(m.punti) from punti_movimenti m where m.utente = p.id), 0)::int,
           p.sospeso_fino,
           p.creato_il,
           coalesce((
             select count(*) from segnalazioni s
             where s.stato = 'aperta' and s.bersaglio::text = p.id::text
           ), 0)::int
    from profiles p
    where p_cerca is null
       or p_cerca = ''
       or p.nome ilike '%' || p_cerca || '%'
    order by p.creato_il desc
    limit greatest(1, least(coalesce(p_quanti, 100), 500));
end;
$$;

revoke execute on function elenco_utenti(text, int) from public, anon;
grant execute on function elenco_utenti(text, int) to authenticated;

/*
 * Promuove o retrocede.
 *
 * Solo un admin, e mai su se stesso: se l'unico admin si togliesse il ruolo per
 * sbaglio non resterebbe nessuno che possa ridarglielo, e si rientrerebbe solo
 * dal pannello di Supabase. Un admin non puo nemmeno toccare un altro admin,
 * cosi due amministratori non possono cacciarsi a vicenda.
 */
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

  update profiles set ruolo = nuovo where id = chi;
end;
$$;

revoke execute on function imposta_ruolo(uuid, text) from public, anon;
grant execute on function imposta_ruolo(uuid, text) to authenticated;

/*
 * Sospende, e con `null` giorni bandisce per sempre.
 *
 * La sospensione non cancella niente di quello che una persona ha gia scritto:
 * le toglie la parola fino alla data. Il bando e la stessa cosa senza data —
 * `infinity` invece di un giorno preciso — cosi il trigger che fa tacere i
 * sospesi vale gia anche per i banditi e non serve una seconda strada.
 *
 * Un admin non si sospende: vale lo stesso motivo di sopra.
 */
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
  -- un moderatore lo ferma solo un admin
  if attuale = 'moderatore' and not e_admin() then
    raise exception 'serve il ruolo di admin';
  end if;

  fino := case when giorni is null then 'infinity'::timestamptz
               else now() + make_interval(days => greatest(1, giorni)) end;
  update profiles set sospeso_fino = fino where id = chi;
  return fino;
end;
$$;

create or replace function revoca_sospensione(chi uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_moderatore() then
    raise exception 'serve il ruolo di moderatore';
  end if;
  update profiles set sospeso_fino = null where id = chi;
end;
$$;

revoke execute on function sospendi_utente(uuid, int) from public, anon;
revoke execute on function revoca_sospensione(uuid) from public, anon;
grant execute on function sospendi_utente(uuid, int) to authenticated;
grant execute on function revoca_sospensione(uuid) to authenticated;

-- ---------------------------------------------- il ramo che mancava in coda

/*
 * Una segnalazione su un profilo finiva in coda e mostrava "Contenuto non piu
 * disponibile": `testo_segnalato` non aveva il ramo `profilo`, quindi chi
 * moderava vedeva una riga da giudicare senza niente da leggere.
 *
 * Il resto della funzione e identico a prima: si riscrive per intero perche
 * cambiare un solo ramo di un `if` in SQL non si puo.
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
  elsif p_tipo = 'profilo' then
    -- su un profilo il "contenuto" e il profilo stesso: nome e presentazione,
    -- che sono le due cose che si possono usare per offendere
    return query
      select p.id, p.nome,
             p.nome || coalesce(E'\n' || p.bio, ''),
             p.creato_il,
             coalesce(p.sospeso_fino > now(), false)
      from profiles p
      where p.id = p_bersaglio::uuid;
  end if;
end;
$$;

-- ------------------------------------------------ un admin cancella in chat

/*
 * Mancava: un admin poteva cancellare discussioni, risposte e trasferte, ma
 * non un messaggio della chat dal vivo. Nasconderlo si poteva, cancellarlo no.
 *
 * Nascondere basta quasi sempre ed e la strada giusta, perche si puo disfare.
 * Cancellare serve per la roba che non deve restare da nessuna parte, nemmeno
 * nella coda di chi modera.
 */
drop policy if exists "un admin cancella qualsiasi messaggio" on messaggi_live;
create policy "un admin cancella qualsiasi messaggio"
  on messaggi_live for delete using (e_admin());
