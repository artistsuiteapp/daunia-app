-- Il primo gradino si chiama Occasionale.
--
-- "Curva Sud" era il nome sbagliato per il livello piu basso: e' il posto dove
-- stanno quelli che ci sono sempre, e darlo a chi ha appena aperto l'app dice
-- il contrario di quello che si vuole dire. "Occasionale" descrive il punto di
-- partenza senza offendere nessuno, e lascia la curva a chi ci arriva.
--
-- Gli altri tre non si toccano.
--
-- La soglia e' la chiave della tabella, quindi si cambia il nome della riga
-- esistente invece di inserirne una nuova: chi e' gia' a quel livello si ritrova
-- il nome nuovo senza che nessun conto cambi.

update livelli set nome = 'Occasionale' where soglia = 0 and nome = 'Curva Sud';
