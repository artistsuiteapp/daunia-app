/**
 * Il guardiano della partita, collegato al mondo vero.
 *
 * Qui ci sono solo i fili: il client Supabase, le variabili d'ambiente e il
 * server. Tutto quello che il guardiano decide sta in `guardiano.ts`, che si
 * prova giocando partite finte in `partita-simulata.test.ts`.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { creaGuardiano } from './guardiano.ts';

/** Il runtime delle Edge Function di Supabase: tiene viva la funzione dopo la risposta. */
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(creaGuardiano({
  db,
  env: (nome) => Deno.env.get(nome),
  // senza il runtime di Supabase (in locale) il guardiano fa un giro al minuto, come prima
  inBackground: typeof EdgeRuntime !== 'undefined' ? (p) => EdgeRuntime.waitUntil(p) : undefined,
}));
