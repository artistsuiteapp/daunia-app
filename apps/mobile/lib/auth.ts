import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase, backendAttivo, messaggioErrore } from './supabase';

/**
 * Accesso, registrazione e profilo.
 *
 * Tutto passa da qui, cosi le schermate non toccano mai supabase direttamente.
 * Senza backend configurato le funzioni restituiscono un errore leggibile
 * invece di rompersi: la dimostrazione continua a funzionare senza account.
 */

export type Profilo = {
  id: string;
  nome: string;
  avatar: string | null;
  bio: string | null;
  settore: string | null;
};

/* -------------------------------------------------------------- sessione */

type Stato = { sessione: Session | null; utente: User | null; caricato: boolean };

let stato: Stato = { sessione: null, utente: null, caricato: !backendAttivo };
const ascoltatori = new Set<() => void>();

function aggiorna(s: Session | null) {
  stato = { sessione: s, utente: s?.user ?? null, caricato: true };
  ascoltatori.forEach((l) => l());
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => aggiorna(data.session));
  supabase.auth.onAuthStateChange((_evento, s) => aggiorna(s));
}

export function useSessione(): Stato {
  const [, forza] = useState(0);
  useEffect(() => {
    const l = () => forza((n) => n + 1);
    ascoltatori.add(l);
    return () => { ascoltatori.delete(l); };
  }, []);
  return stato;
}

export function utenteCorrente(): User | null {
  return stato.utente;
}

/* --------------------------------------------------------- registrazione */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Controlli fatti prima di chiamare il server: l'errore arriva subito. */
export function validaRegistrazione(nome: string, email: string, password: string): string | null {
  if (nome.trim().length < 2) return 'Il nome deve avere almeno 2 caratteri.';
  if (nome.trim().length > 40) return 'Il nome è troppo lungo, massimo 40 caratteri.';
  if (!EMAIL.test(email.trim())) return "L'indirizzo email non sembra valido.";
  if (password.length < 8) return 'La password deve avere almeno 8 caratteri.';
  return null;
}

export async function registrati(nome: string, email: string, password: string) {
  if (!supabase) return { errore: 'Le iscrizioni non sono ancora aperte.' };
  const problema = validaRegistrazione(nome, email, password);
  if (problema) return { errore: problema };

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    // il nome viaggia nei metadati: il trigger crea_profilo lo legge da li
    options: { data: { nome: nome.trim() } },
  });
  if (error) return { errore: messaggioErrore(error) };

  // con la conferma via email attiva non c'e sessione finche non si clicca
  return { errore: null, confermaRichiesta: !data.session };
}

/**
 * Con "resta connesso" tolto la sessione dura finche l'app resta aperta: si
 * cancella quello che e salvato sul dispositivo appena si e entrati.
 */
export async function nonRicordare() {
  if (!supabase) return;
  try {
    const chiavi = Object.keys(globalThis.localStorage ?? {});
    for (const k of chiavi) if (k.startsWith('sb-')) globalThis.localStorage.removeItem(k);
  } catch { /* su telefono resta salvata: la si toglie con Esci */ }
}

export async function accedi(email: string, password: string) {
  if (!supabase) return { errore: 'Le iscrizioni non sono ancora aperte.' };
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  return { errore: error ? messaggioErrore(error) : null };
}

export async function esci() {
  await supabase?.auth.signOut();
}

/**
 * Recupero password.
 *
 * Non si dice mai se l'indirizzo esiste: risponderebbe a chi vuole scoprire chi
 * e iscritto. Il messaggio e sempre lo stesso.
 */
export async function recuperaPassword(email: string, ritorno: string) {
  if (!supabase) return { errore: 'Le iscrizioni non sono ancora aperte.' };
  if (!EMAIL.test(email.trim())) return { errore: "L'indirizzo email non sembra valido." };
  await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: ritorno });
  return { errore: null };
}

export async function cambiaPassword(nuova: string) {
  if (!supabase) return { errore: 'Le iscrizioni non sono ancora aperte.' };
  if (nuova.length < 8) return { errore: 'La password deve avere almeno 8 caratteri.' };
  const { error } = await supabase.auth.updateUser({ password: nuova });
  return { errore: error ? messaggioErrore(error) : null };
}

/* ----------------------------------------------------------------- profilo */

export async function leggiProfilo(id: string): Promise<Profilo | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, nome, avatar, bio, settore')
    .eq('id', id)
    .maybeSingle();
  return (data as Profilo) ?? null;
}

export async function salvaProfilo(campi: Partial<Omit<Profilo, 'id'>>) {
  const u = utenteCorrente();
  if (!supabase || !u) return { errore: 'Devi accedere.' };
  if (campi.nome != null && (campi.nome.trim().length < 2 || campi.nome.trim().length > 40)) {
    return { errore: 'Il nome deve avere fra 2 e 40 caratteri.' };
  }
  if (campi.bio != null && campi.bio.length > 200) {
    return { errore: 'La presentazione è troppo lunga, massimo 200 caratteri.' };
  }
  const { error } = await supabase.from('profiles').update(campi).eq('id', u.id);
  return { errore: error ? messaggioErrore(error) : null };
}

/**
 * Carica l'immagine del profilo.
 *
 * Il percorso comincia con l'identificativo dell'utente perche le regole
 * dell'archivio permettono di scrivere solo dentro la propria cartella. Il nome
 * cambia a ogni caricamento: senza, la copia vecchia resta nelle cache dei
 * browser e l'immagine sembra non essersi aggiornata.
 */
export async function caricaAvatar(file: Blob, estensione: string) {
  const u = utenteCorrente();
  if (!supabase || !u) return { errore: 'Devi accedere.', url: null };
  if (file.size > 2 * 1024 * 1024) {
    return { errore: "L'immagine supera i 2 MB.", url: null };
  }

  const percorso = `${u.id}/${Date.now()}.${estensione}`;
  const { error } = await supabase.storage
    .from('avatar')
    .upload(percorso, file, { contentType: file.type || `image/${estensione}`, upsert: false });
  if (error) return { errore: messaggioErrore(error), url: null };

  const { data } = supabase.storage.from('avatar').getPublicUrl(percorso);
  const salvata = await salvaProfilo({ avatar: data.publicUrl });
  if (salvata.errore) return { errore: salvata.errore, url: null };

  return { errore: null, url: data.publicUrl };
}

export async function rimuoviAvatar() {
  return salvaProfilo({ avatar: null });
}

/**
 * Cancellazione dell'account, per davvero.
 *
 * Chiama una funzione lato server, perche la chiave che sta dentro l'app non
 * puo toccare gli utenti. Apple e Google chiedono che la cancellazione avvenga
 * dentro l'app e che sia una cancellazione vera: disattivare non basta e l'app
 * verrebbe respinta.
 *
 * Chi viene cancellato lo decide il token, non questa chiamata: altrimenti
 * chiunque potrebbe cancellare chiunque.
 */
export async function cancellaAccount() {
  if (!supabase) return { errore: 'Le iscrizioni non sono ancora aperte.' };
  const { data: sessione } = await supabase.auth.getSession();
  const token = sessione.session?.access_token;
  if (!token) return { errore: 'Devi accedere.' };

  const { error } = await supabase.functions.invoke('cancella-account', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) return { errore: messaggioErrore(error) };

  await supabase.auth.signOut();
  return { errore: null };
}
