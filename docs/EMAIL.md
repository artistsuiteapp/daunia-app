# Le email di registrazione

## Perché oggi non arrivano

Il servizio email interno di Supabase consegna **solo agli indirizzi del team del
progetto**, con un tetto di due messaggi all'ora. In pratica: l'unico che riceve
la conferma è il proprietario del progetto. Chiunque altro si iscrive, aspetta
un'email che non parte mai, e resta fuori.

La conferma via email è obbligatoria (`mailer_autoconfirm: false`), quindi senza
un SMTP proprio la registrazione non funziona per nessuno.

Lo stesso vale per il recupero password: senza SMTP non c'è modo di rimandare
qualcuno dentro al proprio account.

## Cosa serve, ed è la parte scomoda

**Un dominio.** Resend non fa spedire da un indirizzo gratuito: va verificato un
dominio che possiedi. Non è un capriccio loro — dal febbraio 2024 Gmail e Yahoo
rifiutano o mandano in spam i messaggi che non passano la verifica del dominio
del mittente.

Un `.it` costa una decina di euro l'anno, e serve comunque per la raccolta
fondi: un link a `iltifodelladaunia.it` si legge meglio di uno a
`daunia.vercel.app`.

## I passaggi

1. **Comprare il dominio.** Un registrar qualsiasi.

2. **Su Resend**: aggiungere il dominio e copiare i tre record DNS (SPF, DKIM,
   e quello di verifica) nel pannello del registrar. La verifica richiede da
   pochi minuti a qualche ora.

3. **Su Resend**: creare una chiave API. Vale come password SMTP.

4. **Metterla dove non finisce nel repository.** Un file `.env` accanto a
   `supabase/config.toml`, che è già escluso da git:

   ```
   SMTP_USER=resend
   SMTP_PASS=<la chiave di Resend>
   ```

5. **In `supabase/config.toml`**: togliere il commento al blocco
   `[auth.email.smtp]` e a quello dei template, e correggere `admin_email` col
   dominio vero.

6. **Spingere la configurazione**:

   ```bash
   cd ~/dev/daunia-app && npx supabase config push
   ```

7. **Provare davvero**: registrarsi con un indirizzo che non è il tuo (chiedilo
   a un amico) e verificare che la conferma arrivi e che il link riporti
   sull'app, non su una pagina di errore.

## Perché la configurazione sta nel repository e non nel pannello

`supabase config push` **sovrascrive** sul progetto remoto quello che c'è in
`config.toml`. Se una impostazione viene cambiata dal pannello di Supabase e non
anche nel file, il primo push la riporta indietro senza avvisare.

Quindi la regola è una sola: il file è la fonte, il pannello no. Se l'SMTP viene
incollato nel pannello invece che messo qui, il prossimo push lo cancella.

## Cosa è già pronto

- **Gli indirizzi di ritorno** sono configurati e spinti: i collegamenti delle
  email tornano su `https://daunia.vercel.app`. Era la trappola più probabile —
  un `site_url` rimasto su `localhost` manda chi si iscrive su una pagina che
  sul suo telefono non esiste.
- **I template in italiano** stanno in `supabase/templates/`: conferma,
  recupero password, accesso senza password, cambio indirizzo. Oggi le email che
  partirebbero sono quelle di default di Supabase, in inglese.
  Supabase non lascia cambiare i template finché il progetto usa il servizio
  interno: *"Email template modification is not available for free tier projects
  using the default email provider"*. Si accendono insieme all'SMTP.

## La scorciatoia, se il dominio non lo vuoi comprare adesso

Si può spegnere la conferma via email: chi si registra entra subito, senza
aspettare niente. Costa due cose, e vanno sapute:

- il **recupero password resta rotto**: senza email non c'è modo di rimandare
  dentro chi l'ha persa
- entra chiunque con un indirizzo **inventato**, e quando servirà scrivere agli
  utenti quegli indirizzi non serviranno a niente

È un ponte, non una soluzione.
