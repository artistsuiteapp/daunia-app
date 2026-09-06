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
del mittente. Cambiare fornitore non aggira la regola: anche Brevo dice che i
domini di Gmail e Yahoo non si possono autenticare.

Va bene un dominio qualsiasi che già possiedi, anche se lo usi per altro. Non
deve essere quello dell'app.

## Usa un sottodominio, non il dominio nudo

Su Resend va aggiunto `mail.iltuodominio.it`, non `iltuodominio.it`. Stesso
lavoro, stessi record. Ma se un giorno queste email finiscono segnalate come
spam, a rimetterci è la reputazione del sottodominio: la casella con cui scrivi
alle persone resta fuori dal rischio.

Chi riceve vede comunque **Il Tifo della Daunia** come mittente. Il nome
visualizzato è separato dall'indirizzo.

## I record DNS, e dove vanno davvero

Questa è la parte che si sbaglia: Resend non li mette tutti sullo stesso nome.
Gli esempi qui sotto valgono per `mail.iltuodominio.it`; i valori esatti li dà
Resend quando aggiungi il dominio.

| Nome | Tipo | Valore |
|---|---|---|
| `send.mail` | TXT | `v=spf1 include:amazonses.com ~all` |
| `send.mail` | MX (priorità 10) | `feedback-smtp.<regione>.amazonses.com` |
| `resend._domainkey.mail` | TXT | la chiave lunga che dà Resend |
| `_dmarc.mail` | TXT | `v=DMARC1; p=none;` |

Il DKIM è lungo e certi pannelli DNS lo troncano senza dirlo: va incollato per
intero.

Il DMARC non serve a Resend ma lo chiedono Gmail e Yahoo dal 2024.

## Controllare prima di premere "verifica"

I record ci mettono da pochi minuti a qualche ora a propagarsi. Invece di
premere "verifica" su Resend ogni due minuti senza sapere se il problema è
l'attesa o un record scritto male:

```bash
cd ~/dev/daunia-app && node controlla-email.mjs mail.iltuodominio.it
```

Dice quale record manca e dove va messo. Interroga i DNS pubblici di Cloudflare
e Google, non quelli di casa, perché la cache del provider può restituire il
"non esiste" di mezz'ora fa.

## I passaggi

1. **Su Resend**: aggiungere `mail.iltuodominio.it` e copiare i record DNS nel
   pannello del registrar.

3. **Su Resend**: creare una chiave API. Vale come password SMTP.

4. **Metterla dove non finisce nel repository.** Un file `.env` accanto a
   `supabase/config.toml`, che è già escluso da git:

   ```
   SMTP_USER=resend
   SMTP_PASS=<la chiave di Resend>
   SMTP_FROM=no-reply@mail.iltuodominio.it
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
