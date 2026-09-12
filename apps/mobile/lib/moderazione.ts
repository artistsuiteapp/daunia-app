/**
 * Segnalare, bloccare, moderare.
 *
 * PERCHE ESISTE
 *
 * Le condizioni d'uso promettevano gia che "ogni contenuto si puo segnalare",
 * e non era vero: la tabella c'era dal primo giorno, il tasto no. Apple (linea
 * guida 1.2) e Google chiedono tre cose a chi pubblica un'app dove la gente
 * scrive: un filtro, un modo per segnalare, un modo per non vedere piu qualcuno.
 * Il filtro girava gia nel database. Questi sono gli altri due.
 *
 * DOVE STA LA FORZA
 *
 * Il blocco non e un filtro nel telefono: e una politica di lettura nel
 * database. Chi hai bloccato non ti viene proprio consegnato, nemmeno se
 * qualcuno chiamasse l'API a mano scavalcando l'app. Un blocco che vive solo
 * nel client e una tenda, non un muro, e per una revisione di Apple non conta.
 *
 * L'ASIMMETRIA, VOLUTA
 *
 * Bloccare qualcuno non glielo dice e non gli toglie niente: serve a chi blocca.
 * Nascondere e sospendere sono cose diverse, e le puo fare solo chi modera.
 */
import { useEffect, useSyncExternalStore } from 'react';

import { supabase, backendAttivo } from './supabase';
import { utenteCorrente } from './auth';

export type Ruolo = 'anonimo' | 'utente' | 'moderatore' | 'admin';

export type TipoBersaglio = 'discussione' | 'risposta' | 'messaggio' | 'trasferta' | 'profilo';

/**
 * I motivi, in ordine di gravita percepita.
 *
 * Sono pochi apposta. Un elenco lungo fa scegliere "altro" a tutti, e una
 * segnalazione senza motivo e una segnalazione che nessuno sa come trattare.
 */
export const MOTIVI = [
  'Insulti o minacce',
  'Odio o discriminazione',
  'Molestie verso una persona',
  'Spam o pubblicità',
  'Contenuto sessuale',
  'Altro',
] as const;
export type Motivo = (typeof MOTIVI)[number];

// ------------------------------------------------------------------ ruolo

let ruoloCorrente: Ruolo = 'anonimo';
const ascoltatori = new Set<() => void>();

function avvisa() {
  for (const f of ascoltatori) f();
}

function iscrivi(f: () => void) {
  ascoltatori.add(f);
  return () => { ascoltatori.delete(f); };
}

/** Ricarica il ruolo di chi ha fatto accesso. Chiamata all'avvio e dopo il login. */
export async function ricaricaRuolo(): Promise<Ruolo> {
  const utente = utenteCorrente();
  if (!supabase || !utente) {
    ruoloCorrente = 'anonimo';
    avvisa();
    return ruoloCorrente;
  }
  const { data } = await supabase.from('profiles').select('ruolo').eq('id', utente.id).maybeSingle();
  ruoloCorrente = (data?.ruolo as Ruolo) ?? 'utente';
  avvisa();
  return ruoloCorrente;
}

export function useRuolo(): Ruolo {
  const r = useSyncExternalStore(iscrivi, () => ruoloCorrente, () => ruoloCorrente);
  useEffect(() => { void ricaricaRuolo(); }, []);
  return r;
}

export function puoModerare(r: Ruolo): boolean {
  return r === 'moderatore' || r === 'admin';
}

// ------------------------------------------------------------ segnalazioni

/**
 * Manda una segnalazione.
 *
 * Torna una frase da mostrare, mai un'eccezione: chi segnala ha gia avuto un
 * fastidio, e un errore tecnico sopra il fastidio e una seconda offesa.
 */
export async function segnala(
  tipo: TipoBersaglio,
  bersaglio: string,
  motivo: Motivo,
  dettaglio?: string,
): Promise<{ ok: boolean; messaggio: string }> {
  const utente = utenteCorrente();
  if (!backendAttivo || !supabase) {
    return { ok: false, messaggio: 'Le segnalazioni funzionano solo con un account.' };
  }
  if (!utente) {
    return { ok: false, messaggio: 'Serve un account per segnalare.' };
  }

  const testo = dettaglio?.trim() ? `${motivo} — ${dettaglio.trim().slice(0, 400)}` : motivo;
  const { error } = await supabase.from('segnalazioni').insert({
    segnalante: utente.id,
    tipo,
    bersaglio,
    motivo: testo,
  });

  // 23505 = l'hai gia segnalato: non e un errore, e la regola "una a testa"
  if (error && error.code === '23505') {
    return { ok: true, messaggio: 'Questo contenuto l’avevi già segnalato. Una volta basta.' };
  }
  if (error) return { ok: false, messaggio: 'Non è partita. Riprova fra poco.' };

  return {
    ok: true,
    messaggio: 'Segnalazione ricevuta. La legge una persona, non un programma. '
      + 'Se anche altri segnalano lo stesso contenuto, sparisce subito in attesa della revisione.',
  };
}

export type MiaSegnalazione = {
  id: string;
  tipo: TipoBersaglio;
  bersaglio: string;
  motivo: string;
  stato: 'aperta' | 'accolta' | 'respinta';
  creata_il: string;
};

/** Le segnalazioni che ho mandato io, con com'e finita. */
export async function mieSegnalazioni(): Promise<MiaSegnalazione[]> {
  const utente = utenteCorrente();
  if (!supabase || !utente) return [];
  const { data } = await supabase
    .from('segnalazioni')
    .select('id, tipo, bersaglio, motivo, stato, creata_il')
    .eq('segnalante', utente.id)
    .order('creata_il', { ascending: false });
  return (data ?? []) as MiaSegnalazione[];
}

// ----------------------------------------------------------------- blocchi

let idBloccati: string[] = [];

export function useBloccati(): string[] {
  const v = useSyncExternalStore(iscrivi, () => idBloccati, () => idBloccati);
  useEffect(() => { void ricaricaBloccati(); }, []);
  return v;
}

export async function ricaricaBloccati(): Promise<string[]> {
  const utente = utenteCorrente();
  if (!supabase || !utente) {
    idBloccati = [];
    avvisa();
    return idBloccati;
  }
  const { data } = await supabase.from('blocchi').select('bloccato').eq('utente', utente.id);
  idBloccati = (data ?? []).map((r: { bloccato: string }) => r.bloccato);
  avvisa();
  return idBloccati;
}

export async function blocca(chi: string): Promise<{ ok: boolean; messaggio: string }> {
  const utente = utenteCorrente();
  if (!supabase || !utente) return { ok: false, messaggio: 'Serve un account per bloccare.' };
  if (chi === utente.id) return { ok: false, messaggio: 'Non puoi bloccare te stesso.' };

  const { error } = await supabase.from('blocchi').insert({ utente: utente.id, bloccato: chi });
  if (error && error.code !== '23505') return { ok: false, messaggio: 'Non è riuscito. Riprova.' };

  await ricaricaBloccati();
  return { ok: true, messaggio: 'Bloccato. Non vedrai più quello che scrive.' };
}

export async function sblocca(chi: string): Promise<boolean> {
  const utente = utenteCorrente();
  if (!supabase || !utente) return false;
  const { error } = await supabase.from('blocchi').delete().eq('utente', utente.id).eq('bloccato', chi);
  if (error) return false;
  await ricaricaBloccati();
  return true;
}

export function eBloccato(chi: string | null | undefined): boolean {
  return Boolean(chi && idBloccati.includes(chi));
}

// --------------------------------------------------------------- moderare

/**
 * Nasconde o rimette in chiaro. Passa solo a chi ha il ruolo: lo decide il
 * database.
 *
 * Restituiva `boolean` e basta, e l'app diceva "Non e riuscito" senza altro.
 * Il 12 settembre, a partita in corso, il tasto non funzionava e da qui non si
 * poteva capire perche: il messaggio del database veniva buttato via. Adesso
 * torna indietro, cosi la prossima volta si legge invece di indovinare.
 */
export async function nascondi(
  tipo: 'discussione' | 'risposta' | 'messaggio',
  id: string,
  nascosto = true,
): Promise<{ ok: boolean; perche?: string }> {
  if (!supabase) return { ok: false, perche: 'Non sei collegato.' };
  const tabella = tipo === 'messaggio' ? 'messaggi_live' : tipo === 'risposta' ? 'risposte' : 'discussioni';
  const campo = tipo === 'messaggio' ? 'nascosto' : 'nascosta';
  const { error } = await supabase.from(tabella).update({ [campo]: nascosto }).eq('id', id);
  return error ? { ok: false, perche: error.message } : { ok: true };
}

/**
 * Sospende un account per N giorni. Solo admin.
 *
 * Non cancella niente di quello che ha gia scritto: gli toglie la parola fino
 * alla data. Apple chiede di poter cacciare chi abusa, non solo di nascondere
 * il singolo messaggio.
 */
/**
 * Cancella per davvero. Solo admin: lo decide il database.
 *
 * Nascondere si disfa, cancellare no, ed e per questo che sta dietro una
 * conferma e non accanto al pollice. Serve per quello che non deve restare da
 * nessuna parte, nemmeno nella coda di chi modera.
 */
export async function elimina(
  tipo: 'discussione' | 'risposta' | 'messaggio',
  id: string,
): Promise<boolean> {
  if (!supabase) return false;
  const tabella = tipo === 'messaggio' ? 'messaggi_live' : tipo === 'risposta' ? 'risposte' : 'discussioni';
  const { error } = await supabase.from(tabella).delete().eq('id', id);
  return !error;
}

export async function sospendi(chi: string, giorni: number): Promise<boolean> {
  if (!supabase) return false;
  const fino = new Date(Date.now() + giorni * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('profiles').update({ sospeso_fino: fino }).eq('id', chi);
  return !error;
}

export async function revocaSospensione(chi: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('profiles').update({ sospeso_fino: null }).eq('id', chi);
  return !error;
}

// ------------------------------------------------------------------- coda

export type VoceCoda = {
  tipo: TipoBersaglio;
  bersaglio: string;
  quante: number;
  motivi: string[];
  prima_il: string;
  ultima_il: string;
  stato: 'aperta' | 'accolta' | 'respinta';
};

export type Segnalato = {
  autore: string;
  nome: string;
  testo: string;
  quando: string;
  nascosto: boolean;
};

/**
 * La coda di chi modera: una riga per contenuto, non per segnalazione.
 *
 * Un messaggio con sei segnalazioni deve occupare una riga sola, altrimenti la
 * coda diventa illeggibile proprio nel giorno in cui serve.
 */
export async function coda(): Promise<VoceCoda[]> {
  if (!supabase) return [];
  const { data } = await supabase.rpc('coda_segnalazioni');
  return (data ?? []) as VoceCoda[];
}

/** Il contenuto sotto giudizio. Legge anche il nascosto: e il punto. */
export async function testoSegnalato(tipo: TipoBersaglio, bersaglio: string): Promise<Segnalato | null> {
  if (!supabase) return null;
  const { data } = await supabase.rpc('testo_segnalato', { p_tipo: tipo, p_bersaglio: bersaglio });
  const righe = (data ?? []) as Segnalato[];
  return righe[0] ?? null;
}

/**
 * Chiude le segnalazioni su un contenuto.
 *
 * `respinta` rimette in chiaro quello che la soglia aveva nascosto: senza,
 * un'assoluzione non servirebbe a niente.
 */
export async function chiudi(
  tipo: TipoBersaglio,
  bersaglio: string,
  esito: 'accolta' | 'respinta',
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('chiudi_segnalazioni', {
    p_tipo: tipo,
    p_bersaglio: bersaglio,
    p_esito: esito,
  });
  return !error;
}
