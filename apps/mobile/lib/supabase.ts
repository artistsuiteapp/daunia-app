import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Collegamento a Supabase.
 *
 * La chiave anon sta dentro l'app ed e giusto cosi: e fatta per essere
 * pubblica. Quello che protegge i dati non e la chiave ma la sicurezza per riga
 * dichiarata in supabase/schema.sql, che decide cosa ogni utente puo leggere e
 * scrivere. La chiave service_role non deve mai entrare in questo file ne in
 * nessun altro dentro apps/mobile: quella salta ogni controllo.
 *
 * Finche le variabili non sono impostate il client resta null e l'app continua
 * a funzionare con i dati nella memoria del dispositivo. Cosi la demo gira
 * anche senza account.
 */

/**
 * L'indirizzo va dato nudo: https://<progetto>.supabase.co
 * Nel pannello pero compare anche con /rest/v1 in coda, e chi copia quello si
 * ritrova il percorso raddoppiato e ogni chiamata a 404. Si taglia qui una volta
 * per tutte invece di scoprirlo a runtime.
 */
function radice(u: string | undefined): string | undefined {
  if (!u) return undefined;
  return u.trim().replace(/\/+$/, '').replace(/\/(rest|auth|storage|realtime)\/v\d.*$/, '');
}

const url = radice(process.env.EXPO_PUBLIC_SUPABASE_URL);
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

/** true quando il progetto e configurato: le schermate lo usano per scegliere. */
export const backendAttivo = Boolean(url && anon);

export const supabase: SupabaseClient | null = backendAttivo
  ? createClient(url!, anon!, {
      auth: {
        // su telefono la sessione va salvata a mano, sul web ci pensa il browser
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // il telefono non torna da un indirizzo con i parametri di accesso
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

/** Errore leggibile invece di un oggetto che nessuno capisce. */
export function messaggioErrore(e: unknown): string {
  if (!e) return 'Errore sconosciuto.';
  const m = (e as { message?: string }).message ?? String(e);
  if (/network|fetch/i.test(m)) return 'Connessione assente. Riprova fra poco.';
  if (/invalid login|credentials/i.test(m)) return 'Email o password non validi.';
  if (/already registered/i.test(m)) return 'Questa email è già registrata.';
  return m;
}
