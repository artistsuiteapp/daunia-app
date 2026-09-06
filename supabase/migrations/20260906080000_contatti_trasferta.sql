-- Come si scrivono, per organizzarsi davvero.
--
-- LA REGOLA: SI VEDE SOLO CHI SI ESPONE
--
-- Il contatto non sta nella tabella pubblica delle trasferte. Sta qui, e lo
-- legge solo chi ha dichiarato a sua volta che va a QUELLA partita. Chi guarda
-- e basta non vede niente, un ospite senza account nemmeno.
--
-- Non e una complicazione gratuita. Un elenco di recapiti leggibile da chiunque
-- con la chiave anonima e una lista pronta per chi raccoglie numeri, e il
-- titolare del trattamento e Salvatore, non i tifosi. Con la reciprocita chi
-- vuole i contatti deve mettere il proprio nome nell'elenco di quella trasferta,
-- che e esattamente quello che fa una persona che si sta organizzando.
--
-- Il contatto resta comunque facoltativo: si puo andare in trasferta e comparire
-- nell'elenco senza lasciare niente.

create table if not exists trasferte_contatti (
  partita     text not null,
  utente      uuid not null references profiles on delete cascade,
  canale      text not null check (canale in ('whatsapp', 'telegram', 'email', 'instagram')),
  riferimento text not null check (length(trim(riferimento)) between 3 and 120),
  creato_il   timestamptz not null default now(),
  primary key (partita, utente),
  foreign key (partita, utente) references trasferte (partita, utente) on delete cascade
);

alter table trasferte_contatti enable row level security;

-- La reciprocita: si legge il contatto di chi va a una partita solo se anche tu
-- hai detto che ci vai. La propria riga si vede sempre, perche la tua presenza
-- nell'elenco soddisfa gia la condizione.
drop policy if exists "i contatti li vede chi va a quella trasferta" on trasferte_contatti;
create policy "i contatti li vede chi va a quella trasferta"
  on trasferte_contatti for select
  using (exists (
    select 1 from trasferte t
    where t.partita = trasferte_contatti.partita
      and t.utente = auth.uid()
  ));

drop policy if exists "ognuno lascia il proprio contatto" on trasferte_contatti;
create policy "ognuno lascia il proprio contatto"
  on trasferte_contatti for all
  using (auth.uid() = utente) with check (auth.uid() = utente);
