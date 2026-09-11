import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';
import { useSessione, utenteCorrente } from './auth';
import { livelloDi, alProssimoLivello, type Livello } from './match-center-core.ts';

/**
 * Punti, classifiche, livelli e badge, dal lato dell'app.
 *
 * Qui non si somma niente e non si assegna niente: i punti li scrive solo il
 * database, da funzioni che controllano le condizioni. Questo file chiede e
 * mostra, punto.
 *
 * Senza account non c'e niente da mostrare, e va detto invece di far vedere
 * una classifica vuota che sembra rotta.
 */

export type Periodo = 'settimana' | 'mese' | 'stagione';

export type RigaClassifica = {
  posizione: number;
  utente: string;
  nome: string;
  avatar: string | null;
  punti: number;
  azioni: number;
};

export type MiaPosizione = {
  posizione: number;
  punti: number;
  azioni: number;
  quantiInClassifica: number;
};

export type Movimento = {
  id: number;
  azione: string;
  chiave: string;
  punti: number;
  creatoIl: string;
};

export type Badge = {
  codice: string;
  nome: string;
  descrizione: string;
  icona: string;
  presoIl: string | null;
};

export const NOME_PERIODO: Record<Periodo, string> = {
  settimana: 'Questa settimana',
  mese: 'Questo mese',
  stagione: 'Stagione',
};

export async function caricaClassifica(periodo: Periodo, quanti = 50): Promise<RigaClassifica[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('classifica', { tipo: periodo, quanti });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    posizione: Number(r.posizione),
    utente: String(r.utente),
    nome: String(r.nome),
    avatar: (r.avatar as string | null) ?? null,
    punti: Number(r.punti),
    azioni: Number(r.azioni),
  }));
}

export async function caricaMiaPosizione(periodo: Periodo): Promise<MiaPosizione | null> {
  if (!supabase || !utenteCorrente()) return null;
  const { data, error } = await supabase.rpc('mia_posizione', { tipo: periodo });
  const riga = (data as Array<Record<string, unknown>> | null)?.[0];
  if (error || !riga) return null;
  return {
    posizione: Number(riga.posizione),
    punti: Number(riga.punti),
    azioni: Number(riga.azioni),
    quantiInClassifica: Number(riga.quanti_in_classifica),
  };
}

export async function caricaPuntiTotali(): Promise<number> {
  if (!supabase || !utenteCorrente()) return 0;
  const { data, error } = await supabase.rpc('punti_totali');
  return error ? 0 : Number(data ?? 0);
}

/** Gli ultimi punti presi, con scritto perche: e la risposta a "perche ho 340 punti". */
export async function caricaMovimenti(quanti = 30): Promise<Movimento[]> {
  const u = utenteCorrente();
  if (!supabase || !u) return [];
  const { data } = await supabase
    .from('punti_movimenti')
    .select('id, azione, chiave, punti, creato_il')
    .eq('utente', u.id)
    .order('creato_il', { ascending: false })
    .limit(quanti);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    azione: String(r.azione),
    chiave: String(r.chiave),
    punti: Number(r.punti),
    creatoIl: String(r.creato_il),
  }));
}

/**
 * Quanti punti si sono presi in una partita, e per cosa.
 *
 * La chiave dei movimenti e l'identificativo della partita, tranne per il quiz
 * dove e la domanda: quelli si contano a parte, con una join che qui non si
 * puo fare. Per il riepilogo di fine gara bastano i primi.
 */
export async function puntiDellaPartita(partita: string): Promise<{ totale: number; per: Movimento[] }> {
  const u = utenteCorrente();
  if (!supabase || !u) return { totale: 0, per: [] };
  const { data } = await supabase
    .from('punti_movimenti')
    .select('id, azione, chiave, punti, creato_il')
    .eq('utente', u.id)
    .eq('chiave', partita);
  const per = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    azione: String(r.azione),
    chiave: String(r.chiave),
    punti: Number(r.punti),
    creatoIl: String(r.creato_il),
  }));
  return { totale: per.reduce((n, m) => n + m.punti, 0), per };
}

/**
 * Tutti i badge, con dentro quali sono stati presi.
 *
 * Anche quelli che mancano, apposta: un badge che non si sa che esiste non fa
 * venire voglia di prenderlo.
 */
export async function caricaBadge(utente?: string): Promise<Badge[]> {
  if (!supabase) return [];
  const chi = utente ?? utenteCorrente()?.id ?? null;
  const [catalogo, presi] = await Promise.all([
    supabase.from('badge').select('codice, nome, descrizione, icona'),
    chi
      ? supabase.from('badge_utente').select('badge, preso_il').eq('utente', chi)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const quando = new Map<string, string>();
  for (const r of ((presi as { data?: Array<Record<string, unknown>> }).data ?? [])) {
    quando.set(String(r.badge), String(r.preso_il));
  }

  return ((catalogo.data ?? []) as Array<Record<string, unknown>>).map((b) => ({
    codice: String(b.codice),
    nome: String(b.nome),
    descrizione: String(b.descrizione),
    icona: String(b.icona),
    presoIl: quando.get(String(b.codice)) ?? null,
  }));
}

/**
 * Dice al database che si e condiviso.
 *
 * Non si puo verificare che la condivisione sia avvenuta davvero, e infatti il
 * premio e piccolo e vale una volta al giorno: il tetto e una chiave unica sul
 * giorno, non un contatore che si puo confondere.
 */
export async function segnalaCondivisione(): Promise<number> {
  if (!supabase || !utenteCorrente()) return 0;
  const { data, error } = await supabase.rpc('punti_condivisione');
  return error ? 0 : Number(data ?? 0);
}

/* ------------------------------------------------------------------- hook */

export function useClassifica(periodo: Periodo) {
  const { utente } = useSessione();
  const [righe, setRighe] = useState<RigaClassifica[]>([]);
  const [mia, setMia] = useState<MiaPosizione | null>(null);
  const [caricato, setCaricato] = useState(false);

  const ricarica = useCallback(async () => {
    const [c, m] = await Promise.all([caricaClassifica(periodo), caricaMiaPosizione(periodo)]);
    setRighe(c);
    setMia(m);
    setCaricato(true);
  }, [periodo]);

  useEffect(() => { setCaricato(false); void ricarica(); }, [ricarica, utente?.id]);

  return { righe, mia, caricato, ricarica };
}

export function useMieiPunti() {
  const { utente } = useSessione();
  const [punti, setPunti] = useState(0);
  const [badge, setBadge] = useState<Badge[]>([]);
  const [caricato, setCaricato] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!utente) { setPunti(0); setBadge([]); setCaricato(true); return; }
    setCaricato(false);
    void Promise.all([caricaPuntiTotali(), caricaBadge()]).then(([p, b]) => {
      if (!vivo) return;
      setPunti(p);
      setBadge(b);
      setCaricato(true);
    });
    return () => { vivo = false; };
  }, [utente?.id]);

  const livello: Livello = livelloDi(punti);
  return { punti, badge, livello, prossimo: alProssimoLivello(punti), caricato };
}

export { livelloDi, alProssimoLivello } from './match-center-core.ts';
export type { Livello } from './match-center-core.ts';
