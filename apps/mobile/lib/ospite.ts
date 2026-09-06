import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSessione, utenteCorrente } from './auth';
import { backendAttivo } from './supabase';

/**
 * Modalita ospite.
 *
 * Si puo guardare tutto senza account: partite, classifica, rosa, statistiche,
 * stadio, discussioni. Non si puo scrivere, votare, pronosticare o dichiarare la
 * presenza, perche quelle cose finiscono in un elenco pubblico e senza un nome
 * dietro diventano ingestibili.
 *
 * La scelta si ricorda: chi ha detto "guardo e basta" non se lo deve sentire
 * chiedere a ogni apertura.
 */

const CHIAVE = 'daunia.ospite.v1';

let scelto = false;
let caricato = false;
const ascoltatori = new Set<() => void>();

function notifica() { ascoltatori.forEach((l) => l()); }

async function leggi() {
  try {
    const v = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(CHIAVE)
      : await AsyncStorage.getItem(CHIAVE);
    scelto = v === '1';
  } catch {
    scelto = false;
  }
  caricato = true;
  notifica();
}
void leggi();

export async function continuaComeOspite() {
  scelto = true;
  caricato = true;
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(CHIAVE, '1');
    else await AsyncStorage.setItem(CHIAVE, '1');
  } catch { /* senza memoria la scelta vale per questa sessione */ }
  notifica();
}

export async function dimenticaScelta() {
  scelto = false;
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(CHIAVE);
    else await AsyncStorage.removeItem(CHIAVE);
  } catch { /* niente da fare */ }
  notifica();
}

/**
 * Se mostrare il benvenuto.
 *
 * Mai quando non c'e un database configurato: in quel caso non esistono account
 * e chiedere di iscriversi sarebbe una porta che non si apre.
 */
export function useBenvenuto(): { mostra: boolean; pronto: boolean } {
  const [, forza] = useState(0);
  useEffect(() => {
    const l = () => forza((n) => n + 1);
    ascoltatori.add(l);
    return () => { ascoltatori.delete(l); };
  }, []);
  /*
   * Anche alla sessione, non solo a questo negozio.
   *
   * Prima ascoltava solo gli avvisi di "ospite" ma la decisione dipende anche
   * dall'utente: uno faceva l'accesso, la sessione arrivava, e qui non se ne
   * accorgeva nessuno. Restava la schermata di benvenuto addosso a uno che era
   * gia dentro.
   */
  useSessione();

  if (!backendAttivo) return { mostra: false, pronto: true };
  if (!caricato) return { mostra: false, pronto: false };
  return { mostra: !scelto && !utenteCorrente(), pronto: true };
}

/** true quando si sta guardando senza account: le azioni che scrivono si bloccano. */
export function useOspite(): boolean {
  const [, forza] = useState(0);
  useEffect(() => {
    const l = () => forza((n) => n + 1);
    ascoltatori.add(l);
    return () => { ascoltatori.delete(l); };
  }, []);
  // stesso motivo: senza questo, dopo l'accesso le schermate continuano a
  // trattare come ospite uno che ha appena messo la password
  useSessione();
  return backendAttivo && !utenteCorrente();
}

export function isOspite(): boolean {
  return backendAttivo && !utenteCorrente();
}
