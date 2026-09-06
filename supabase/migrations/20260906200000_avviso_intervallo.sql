-- Il nuovo avviso di fine primo tempo.
--
-- Il guardiano filtra le iscrizioni con `preferenze->>'intervallo' = 'true'`:
-- le righe gia registrate quella chiave non ce l'hanno, quindi senza questo
-- aggiornamento nessuno riceverebbe il nuovo avviso e sembrerebbe rotto.
-- Acceso di default come gli altri: chi non lo vuole lo spegne dalle
-- impostazioni, e la sua scelta non viene toccata da qui.

update push_iscrizioni
set preferenze = preferenze || '{"intervallo": true}'::jsonb
where not (preferenze ? 'intervallo');
