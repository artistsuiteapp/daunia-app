import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';
import { dimentica } from './identita';
import { livelloDi, type Livello } from './match-center-core.ts';
import type { Ruolo } from './moderazione';

/**
 * Il pannello di chi amministra, dal lato dell'app.
 *
 * PERCHE PASSA TUTTO DA FUNZIONI DEL DATABASE
 *
 * La politica di scrittura su `profiles` e `auth.uid() = id`: un admin che
 * provasse a sospendere qualcuno con un UPDATE dal client non riceverebbe un
 * errore, riceverebbe zero righe modificate. Il tasto sembrerebbe funzionare e
 * non succederebbe niente. Le funzioni `security definer` controllano il ruolo
 * e sollevano un errore vero quando qualcosa non va.
 *
 * Qui non si decide chi puo fare cosa: lo decide il database. Questo file
 * chiede e riporta il messaggio.
 */

export type UtenteInElenco = {
  utente: string;
  nome: string;
  avatar: string | null;
  ruolo: Ruolo;
  punti: number;
  livello: Livello;
  sospesoFino: string | null;
  iscrittoIl: string;
  segnalazioni: number;
};

/** Vero se la sospensione e senza scadenza: e un bando, non una pausa. */
export function eBandito(sospesoFino: string | null): boolean {
  if (!sospesoFino) return false;
  const t = Date.parse(sospesoFino);
  // 'infinity' non si converte in un numero: e esattamente il caso del bando
  return !Number.isFinite(t) || t - Date.now() > 100 * 365 * 24 * 3600 * 1000;
}

export function eSospeso(sospesoFino: string | null): boolean {
  if (!sospesoFino) return false;
  const t = Date.parse(sospesoFino);
  return !Number.isFinite(t) || t > Date.now();
}

export async function elencoUtenti(cerca = '', quanti = 100): Promise<UtenteInElenco[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('elenco_utenti', {
    p_cerca: cerca.trim() || null,
    p_quanti: quanti,
  });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => {
    const punti = Number(r.punti ?? 0);
    return {
      utente: String(r.utente),
      nome: String(r.nome ?? 'Tifoso'),
      avatar: (r.avatar as string | null) ?? null,
      ruolo: ((r.ruolo as Ruolo | null) ?? 'utente'),
      punti,
      livello: livelloDi(punti),
      sospesoFino: (r.sospeso_fino as string | null) ?? null,
      iscrittoIl: String(r.iscritto_il),
      segnalazioni: Number(r.segnalazioni ?? 0),
    };
  });
}

type Esito = { ok: boolean; messaggio: string };

/** Il messaggio del database e gia in italiano e gia chiaro: si mostra quello. */
function daErrore(messaggio: string | undefined): Esito {
  return { ok: false, messaggio: messaggio?.replace(/^.*?:\s*/, '') || 'Non è riuscito. Riprova.' };
}

export async function cambiaRuolo(chi: string, nuovo: Ruolo): Promise<Esito> {
  if (!supabase) return { ok: false, messaggio: 'Non c’è collegamento.' };
  const { error } = await supabase.rpc('imposta_ruolo', { chi, nuovo });
  if (error) return daErrore(error.message);
  dimentica(chi);
  return { ok: true, messaggio: `Adesso è ${nuovo}.` };
}

/** `giorni` a null vuol dire per sempre. */
export async function sospendiUtente(chi: string, giorni: number | null): Promise<Esito> {
  if (!supabase) return { ok: false, messaggio: 'Non c’è collegamento.' };
  const { error } = await supabase.rpc('sospendi_utente', { chi, giorni });
  if (error) return daErrore(error.message);
  dimentica(chi);
  return {
    ok: true,
    messaggio: giorni == null
      ? 'Bandito. Non può più scrivere niente.'
      : `Sospeso per ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}.`,
  };
}

export async function riammetti(chi: string): Promise<Esito> {
  if (!supabase) return { ok: false, messaggio: 'Non c’è collegamento.' };
  const { error } = await supabase.rpc('revoca_sospensione', { chi });
  if (error) return daErrore(error.message);
  dimentica(chi);
  return { ok: true, messaggio: 'Può tornare a scrivere.' };
}

export function useElencoUtenti(cerca: string) {
  const [righe, setRighe] = useState<UtenteInElenco[]>([]);
  const [caricato, setCaricato] = useState(false);

  const ricarica = useCallback(async () => {
    const r = await elencoUtenti(cerca);
    setRighe(r);
    setCaricato(true);
  }, [cerca]);

  useEffect(() => {
    // si aspetta che uno smetta di scrivere: una chiamata per lettera e uno
    // spreco, e le risposte tornerebbero fuori ordine
    const t = setTimeout(() => { void ricarica(); }, cerca ? 280 : 0);
    return () => clearTimeout(t);
  }, [ricarica, cerca]);

  return { righe, caricato, ricarica };
}

/** Quante segnalazioni aspettano: il numero che va sul pallino del pannello. */
export async function quanteSegnalazioniAperte(): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase
    .from('segnalazioni')
    .select('id', { count: 'exact', head: true })
    .eq('stato', 'aperta');
  return count ?? 0;
}
