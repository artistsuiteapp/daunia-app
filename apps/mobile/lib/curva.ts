/**
 * La Formazione della Curva: memoria e rete.
 *
 * Stesso meccanismo di fanplay.ts: la scelta personale sta nel telefono, il
 * dato d'insieme arriva dal database. Senza account si puo schierare lo stesso,
 * ma resta sul dispositivo e non entra nel conteggio: e la ragione per cui uno
 * si registra, e va detta chiaramente nella schermata, non nascosta.
 *
 * Le regole (conteggio, confronto, striscia) stanno in curva-core.ts, che e
 * senza React e sotto test.
 */
import { useEffect, useSyncExternalStore } from 'react';

import { supabase } from './supabase';
import { utenteCorrente } from './auth';
import { conta, striscia as calcolaStriscia, type Conteggio } from './curva-core';

const KEY = 'daunia.curva.v1';

type Store = {
  /** la propria formazione: id partita -> undici id giocatore */
  mie: Record<string, string[]>;
  /** l'undici della curva dal database: id partita -> conteggi */
  curva: Record<string, Conteggio[]>;
  /** quanti tifosi hanno schierato: id partita -> numero */
  votanti: Record<string, number>;
  /** partite gia interrogate, per non richiedere a ogni render */
  chieste: string[];
};

const VUOTO: Store = { mie: {}, curva: {}, votanti: {}, chieste: [] };

function leggi(): Store {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? { ...VUOTO, ...(JSON.parse(raw) as Store) } : { ...VUOTO };
  } catch {
    return { ...VUOTO };
  }
}

let store = leggi();
const ascoltatori = new Set<() => void>();

function salva() {
  try {
    // la parte che arriva dal database non si salva: si richiede, cosi non
    // resta in giro un conteggio vecchio che sembra fresco
    const { mie } = store;
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ mie }));
  } catch {
    /* niente memoria: resta solo per questa sessione */
  }
  ascoltatori.forEach((f) => f());
}

function sottoscrivi(f: () => void) {
  ascoltatori.add(f);
  return () => { ascoltatori.delete(f); };
}

const istantanea = () => store;

/** Aggancia una schermata allo store e chiede il dato d'insieme una volta sola. */
export function useCurva(matchId: string | null): Store {
  useEffect(() => {
    if (matchId) void caricaCurva(matchId);
  }, [matchId]);
  return useSyncExternalStore(sottoscrivi, istantanea, istantanea);
}

/** Il conteggio d'insieme, dalla funzione aggregata: mai chi ha votato cosa. */
export async function caricaCurva(matchId: string) {
  if (!supabase || store.chieste.includes(matchId)) return;
  store = { ...store, chieste: [...store.chieste, matchId] };
  const { data, error } = await supabase.rpc('undici_curva', { p_partita: matchId });
  if (error || !Array.isArray(data)) return;

  const conteggi: Conteggio[] = data.map((r: { giocatore: string; voti: number }) => ({
    id: String(r.giocatore),
    voti: Number(r.voti) || 0,
  }));
  const quanti = Number(data[0]?.votanti) || 0;
  store = {
    ...store,
    curva: { ...store.curva, [matchId]: conteggi },
    votanti: { ...store.votanti, [matchId]: quanti },
  };
  salva();
}

/** La formazione che ho schierato io per questa partita. */
export function miaFormazione(matchId: string): string[] {
  return store.mie[matchId] ?? [];
}

/**
 * Schiera un undici.
 *
 * Con un account finisce nel database e conta nel totale della curva; senza,
 * resta nel telefono. La schermata lo dice prima, non dopo.
 */
export async function schiera(matchId: string, giocatori: string[]) {
  const undici = [...new Set(giocatori)].slice(0, 11);
  store = { ...store, mie: { ...store.mie, [matchId]: undici } };
  salva();

  const u = await utenteCorrente();
  if (!u || !supabase || undici.length !== 11) return;

  await supabase.from('formazioni_curva').upsert({
    utente: u.id,
    partita: matchId,
    giocatori: undici,
  });
  // il conteggio e cambiato: si rilegge
  store = { ...store, chieste: store.chieste.filter((x) => x !== matchId) };
  await caricaCurva(matchId);
}

/** Toglie la propria formazione, in locale e dal database. */
export async function ritira(matchId: string) {
  const { [matchId]: _via, ...resto } = store.mie;
  store = { ...store, mie: resto };
  salva();

  const u = await utenteCorrente();
  if (!u || !supabase) return;
  await supabase.from('formazioni_curva').delete().eq('utente', u.id).eq('partita', matchId);
  store = { ...store, chieste: store.chieste.filter((x) => x !== matchId) };
  await caricaCurva(matchId);
}

export type VoceCurva = Conteggio & { percento: number };

/**
 * L'undici della curva con il consenso in percentuale.
 *
 * Se il database non ha ancora risposto, o non c'e backend, si mostra almeno la
 * propria: meglio una schermata che risponde con un solo voto che una vuota che
 * non spiega niente.
 */
export function undiciCurva(matchId: string): { voci: VoceCurva[]; votanti: number; solaMia: boolean } {
  const dal = store.curva[matchId];
  const quanti = store.votanti[matchId] ?? 0;

  if (dal?.length && quanti > 0) {
    return {
      voci: dal.map((c) => ({ ...c, percento: Math.round((c.voti / quanti) * 100) })),
      votanti: quanti,
      solaMia: false,
    };
  }

  const mia = store.mie[matchId] ?? [];
  if (!mia.length) return { voci: [], votanti: 0, solaMia: false };
  return {
    voci: conta([mia]).map((c) => ({ ...c, percento: 100 })),
    votanti: 1,
    solaMia: true,
  };
}

/** Quante giornate di fila hai schierato la squadra. */
export function striscia(giornate: string[]): number {
  return calcolaStriscia(giornate, Object.keys(store.mie));
}

/** Quante formazioni hai schierato in tutto. */
export function quanteSchierate(): number {
  return Object.keys(store.mie).length;
}
