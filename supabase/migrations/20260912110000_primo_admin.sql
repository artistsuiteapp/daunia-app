/*
 * Il primo admin.
 *
 * IL PROBLEMA
 *
 * La colonna `ruolo` nasce con 'utente' per tutti e nessuna migrazione ha mai
 * promosso nessuno. Finche non c'e un admin, il pannello non si apre a nessuno
 * e l'unico modo per promuovere qualcuno e aprire il pannello di Supabase e
 * scrivere una riga di SQL a mano — cioe uscire dall'app per amministrare
 * l'app.
 *
 * LA REGOLA, E PERCHE E QUESTA
 *
 * Se non c'e ancora nessun admin, lo diventa il primo account registrato. E
 * un'ipotesi, non una certezza, ma e l'ipotesi giusta: il primo account di
 * un'app e quello di chi l'ha costruita, che si e iscritto per provarla.
 *
 * L'indirizzo email non sta scritto qui apposta: questo archivio e pubblico, e
 * un indirizzo scritto in chiaro in un file su GitHub finisce nelle liste di
 * chi raccoglie indirizzi. La data di iscrizione dice la stessa cosa senza
 * dirlo a tutti.
 *
 * Gira una volta sola: appena c'e un admin, la condizione e falsa e non
 * succede piu niente, nemmeno se la migrazione venisse riapplicata. E si
 * corregge dal pannello, che adesso c'e.
 */
update profiles
set ruolo = 'admin'
where id = (select id from profiles order by creato_il asc limit 1)
  and not exists (select 1 from profiles where ruolo = 'admin');
