-- Chi modera deve poter vedere quello che ha nascosto.

/*
 * IL DIFETTO, visto dal vivo il 12 settembre a partita in corso.
 *
 * Un admin preme "nascondi" su un messaggio della chat e l'app risponde
 * "Non e riuscito". Il tasto non ha mai funzionato -- ne in chat, ne nella
 * Curva, ne sulle risposte.
 *
 * Il motivo non e il permesso di scrivere, che c'e:
 *   create policy "chi modera nasconde i messaggi"
 *     on messaggi_live for update using (e_moderatore());
 *
 * E' il permesso di RILEGGERE. La regola di lettura e
 *   using (not nascosto and utente not in (select bloccati()))
 * senza eccezione per chi modera. PostgREST, dopo un update, restituisce la
 * riga aggiornata -- e per restituirla la deve poter leggere. La riga adesso
 * ha `nascosto = true`, quindi la lettura la nega, e quello che arriva al
 * telefono e un errore. La scrittura era andata a buon fine.
 *
 * Il difetto e nascosto bene proprio perche le due meta sono in due regole
 * diverse: si guarda la UPDATE, la si trova giusta, e non si pensa alla SELECT.
 *
 * E' anche un buco funzionale, non solo tecnico: chi modera non poteva
 * rileggere quello che aveva nascosto, quindi non poteva rimetterlo in chiaro
 * se sbagliava. Nascondere era un'operazione senza ritorno.
 *
 * La riparazione non allarga la regola esistente -- le politiche si sommano in
 * OR, quindi si aggiunge una seconda regola solo per chi modera. Chi non
 * modera continua a vedere esattamente quello che vedeva prima.
 */

drop policy if exists "chi modera vede anche i messaggi nascosti" on messaggi_live;
create policy "chi modera vede anche i messaggi nascosti"
  on messaggi_live for select
  using (e_moderatore());

drop policy if exists "chi modera vede anche le discussioni nascoste" on discussioni;
create policy "chi modera vede anche le discussioni nascoste"
  on discussioni for select
  using (e_moderatore());

drop policy if exists "chi modera vede anche le risposte nascoste" on risposte;
create policy "chi modera vede anche le risposte nascoste"
  on risposte for select
  using (e_moderatore());
