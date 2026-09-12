import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';
import { useSessione, utenteCorrente } from './auth';
import type { Fase } from './match-center-core.ts';

/**
 * I sondaggi del Match Center.
 *
 * Qui non si assegna niente: i punti li da una funzione nel database, che
 * controlla anche che il sondaggio sia aperto. Con la chiave anonima dentro
 * l'app, un punto che si puo scrivere dal client e un punto che non vale
 * niente.
 */

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
