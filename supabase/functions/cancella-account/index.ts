/**
 * Cancellazione dell'account, per davvero.
 *
 * Apple lo chiede dal giugno 2022 e Google dal maggio 2024: chi permette di
 * creare un account deve permettere di cancellarlo dentro l'app, e disattivarlo
 * non basta. Senza questa funzione l'app viene respinta dalla revisione.
 *
 * Serve una funzione lato server perche la chiave che sta dentro l'app non puo
 * toccare auth.users: solo la chiave di servizio puo, e quella non deve mai
 * uscire da qui. Supabase la mette a disposizione da sola nell'ambiente della
 * funzione, quindi non va copiata da nessuna parte.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function risposta(corpo: unknown, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return risposta({ errore: 'Metodo non ammesso.' }, 405);

  const intestazione = req.headers.get('Authorization') ?? '';
  const token = intestazione.replace(/^Bearer\s+/i, '');
  if (!token) return risposta({ errore: 'Manca il token di accesso.' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const chiaveServizio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Si verifica il token con la chiave pubblica: chi chiama puo cancellare solo
  // se stesso, e l'identificativo lo decide il token, non il corpo della
  // richiesta. Se arrivasse dal corpo chiunque potrebbe cancellare chiunque.
  const comeUtente = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: chi, error: erroreChi } = await comeUtente.auth.getUser();
  if (erroreChi || !chi.user) return risposta({ errore: 'Sessione non valida.' }, 401);

  const id = chi.user.id;
  const admin = createClient(url, chiaveServizio);

  // 1. le immagini caricate: stanno in una cartella per utente
  const { data: file } = await admin.storage.from('avatar').list(id);
  if (file?.length) {
    await admin.storage.from('avatar').remove(file.map((f) => `${id}/${f.name}`));
  }

  // 2. quello che ha scritto resta, ma senza di lui: cancellare le discussioni
  //    spezzerebbe le conversazioni degli altri, ed e scritto nell'informativa
  await admin.from('discussioni').update({ nascosta: true }).eq('autore', id);
  await admin.from('risposte').update({ nascosta: true }).eq('autore', id);

  // 3. l'utente: le tabelle collegate cadono in cascata dallo schema
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return risposta({ errore: error.message }, 500);

  return risposta({ fatto: true });
});
