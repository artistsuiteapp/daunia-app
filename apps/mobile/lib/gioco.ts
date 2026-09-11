import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';
import { useSessione, utenteCorrente } from './auth';
import type { Fase } from './match-center-core.ts';

/**
 * Quiz e sondaggi.
 *
 * LA RISPOSTA GIUSTA QUI DENTRO NON C'E
 *
 * L'app legge le domande da una vista che la colonna della risposta non ce
 * l'ha, e la scopre solo rispondendo. Non e pignoleria: la chiave anonima sta
 * dentro l'app, quindi chiunque puo interrogare l'API per conto suo. Una
 * risposta che il client conosce e una risposta pubblica, anche se
 * l'interfaccia non la mostra.
 *
 * Anche i punti passano di li: qui non si assegna niente.
 */

export type Domanda = {
  id: string;
  partita: string | null;
  fase: string;
  testo: string;
  opzioni: string[];
  aperta: boolean;
  /** null finche non si e risposto */
  miaScelta: number | null;
  miaGiusta: boolean | null;
};

export type Esito = {
  esatta: boolean;
  corretta: number;
  spiegazione: string | null;
  punti: number;
  giaRisposto: boolean;
};

export type Sondaggio = {
  id: string;
  partita: string | null;
  fase: string;
  testo: string;
  opzioni: string[];
  aperto: boolean;
  /** quanti hanno scelto ogni opzione, nello stesso ordine di `opzioni` */
  voti: number[];
  miaScelta: number | null;
};

const aperto = (apre: string | null, chiude: string | null, adesso = Date.now()) =>
  (!apre || Date.parse(apre) <= adesso) && (!chiude || Date.parse(chiude) > adesso);

/* -------------------------------------------------------------------- quiz */

export async function caricaQuiz(partita: string | null, fase?: Fase | 'giornaliero'): Promise<Domanda[]> {
  if (!supabase) return [];

  let q = supabase
    .from('quiz_pubblici')
    .select('id, partita, fase, testo, opzioni, aperta, ordine')
    .order('ordine', { ascending: true });
  q = partita === null ? q.is('partita', null) : q.eq('partita', partita);
  if (fase) q = q.eq('fase', fase);

  const { data } = await q;
  const domande = ((data ?? []) as Array<Record<string, unknown>>).map((d) => ({
    id: String(d.id),
    partita: (d.partita as string | null) ?? null,
    fase: String(d.fase),
    testo: String(d.testo),
    opzioni: (d.opzioni as string[]) ?? [],
    aperta: Boolean(d.aperta),
    miaScelta: null as number | null,
    miaGiusta: null as boolean | null,
  }));

  const u = utenteCorrente();
  if (!u || domande.length === 0) return domande;

  const { data: mie } = await supabase
    .from('quiz_risposte')
    .select('domanda, scelta, giusta')
    .in('domanda', domande.map((d) => d.id));

  const per = new Map<string, { scelta: number; giusta: boolean }>();
  for (const r of ((mie ?? []) as Array<Record<string, unknown>>)) {
    per.set(String(r.domanda), { scelta: Number(r.scelta), giusta: Boolean(r.giusta) });
  }

  return domande.map((d) => {
    const mia = per.get(d.id);
    return mia ? { ...d, miaScelta: mia.scelta, miaGiusta: mia.giusta } : d;
  });
}

export async function rispondi(domanda: string, scelta: number): Promise<Esito | { errore: string }> {
  if (!supabase) return { errore: 'Serve un account per rispondere.' };
  const { data, error } = await supabase.rpc('rispondi_quiz', { la_domanda: domanda, la_scelta: scelta });
  if (error) return { errore: leggibile(error.message) };
  const r = (data as Array<Record<string, unknown>> | null)?.[0];
  if (!r) return { errore: 'Non è arrivata risposta. Riprova.' };
  return {
    esatta: Boolean(r.esatta),
    corretta: Number(r.corretta),
    spiegazione: (r.spiegazione as string | null) ?? null,
    punti: Number(r.punti),
    giaRisposto: Boolean(r.gia_risposto),
  };
}

/** Quante ne ha prese in questa partita: serve al riepilogo di fine gara. */
export async function quizFatti(partita: string | null): Promise<{ risposte: number; giuste: number }> {
  if (!supabase || !utenteCorrente()) return { risposte: 0, giuste: 0 };
  const { data } = await supabase.rpc('quiz_fatti', { la_partita: partita });
  const r = (data as Array<Record<string, unknown>> | null)?.[0];
  return { risposte: Number(r?.risposte ?? 0), giuste: Number(r?.giuste ?? 0) };
}

/* --------------------------------------------------------------- sondaggi */

export async function caricaSondaggi(partita: string | null, fase?: Fase | 'sempre'): Promise<Sondaggio[]> {
  if (!supabase) return [];

  let q = supabase
    .from('sondaggi')
    .select('id, partita, fase, testo, opzioni, apre_il, chiude_il, ordine')
    .order('ordine', { ascending: true });
  q = partita === null ? q.is('partita', null) : q.eq('partita', partita);
  if (fase) q = q.eq('fase', fase);

  const { data } = await q;
  const righe = (data ?? []) as Array<Record<string, unknown>>;
  if (righe.length === 0) return [];

  const ids = righe.map((s) => String(s.id));
  const [{ data: risultati }, { data: miei }] = await Promise.all([
    supabase.from('sondaggio_risultati').select('sondaggio, scelta, quanti').in('sondaggio', ids),
    utenteCorrente()
      ? supabase.from('sondaggio_voti').select('sondaggio, scelta').in('sondaggio', ids)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const conteggi = new Map<string, Map<number, number>>();
  for (const r of ((risultati ?? []) as Array<Record<string, unknown>>)) {
    const per = conteggi.get(String(r.sondaggio)) ?? new Map<number, number>();
    per.set(Number(r.scelta), Number(r.quanti));
    conteggi.set(String(r.sondaggio), per);
  }
  const mieScelte = new Map<string, number>();
  for (const r of ((miei ?? []) as Array<Record<string, unknown>>)) {
    mieScelte.set(String(r.sondaggio), Number(r.scelta));
  }

  return righe.map((s) => {
    const opzioni = (s.opzioni as string[]) ?? [];
    const per = conteggi.get(String(s.id));
    return {
      id: String(s.id),
      partita: (s.partita as string | null) ?? null,
      fase: String(s.fase),
      testo: String(s.testo),
      opzioni,
      aperto: aperto((s.apre_il as string | null) ?? null, (s.chiude_il as string | null) ?? null),
      voti: opzioni.map((_, i) => per?.get(i) ?? 0),
      miaScelta: mieScelte.get(String(s.id)) ?? null,
    };
  });
}

export async function vota(sondaggio: string, scelta: number): Promise<{ punti: number } | { errore: string }> {
  if (!supabase) return { errore: 'Serve un account per votare.' };
  const { data, error } = await supabase.rpc('vota_sondaggio', { il_sondaggio: sondaggio, la_scelta: scelta });
  if (error) return { errore: leggibile(error.message) };
  return { punti: Number(data ?? 0) };
}

/** Il database parla per i registri; qui si parla a una persona. */
function leggibile(messaggio: string): string {
  if (/serve un account/i.test(messaggio)) return 'Per giocare serve un account.';
  if (/non e aperta|non e aperto/i.test(messaggio)) return 'Questa è chiusa: il tempo è scaduto.';
  if (/fuori elenco/i.test(messaggio)) return 'Quella risposta non esiste.';
  return 'Non è andata. Riprova fra un momento.';
}

/* -------------------------------------------------------------------- hook */

export function useQuiz(partita: string | null, fase?: Fase | 'giornaliero') {
  const { utente } = useSessione();
  const [domande, setDomande] = useState<Domanda[]>([]);
  const [caricato, setCaricato] = useState(false);

  const ricarica = useCallback(async () => {
    setDomande(await caricaQuiz(partita, fase));
    setCaricato(true);
  }, [partita, fase]);

  useEffect(() => { setCaricato(false); void ricarica(); }, [ricarica, utente?.id]);

  return { domande, caricato, ricarica };
}

export function useSondaggi(partita: string | null, fase?: Fase | 'sempre') {
  const { utente } = useSessione();
  const [sondaggi, setSondaggi] = useState<Sondaggio[]>([]);
  const [caricato, setCaricato] = useState(false);

  const ricarica = useCallback(async () => {
    setSondaggi(await caricaSondaggi(partita, fase));
    setCaricato(true);
  }, [partita, fase]);

  useEffect(() => { setCaricato(false); void ricarica(); }, [ricarica, utente?.id]);

  return { sondaggi, caricato, ricarica };
}
