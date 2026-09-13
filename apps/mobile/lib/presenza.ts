import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from './supabase';
import { useSessione } from './auth';

/**
 * Chi c'e adesso.
 *
 * COME FUNZIONA
 *
 * Il telefono dice "ci sono" al database ogni minuto finche l'app e aperta, e
 * "me ne vado" quando va in secondo piano. Chi sia lo decide il token di
 * accesso, non il telefono: nome e foto nell'elenco vengono dal profilo.
 *
 * PERCHE NON PIU REALTIME
 *
 * Prima si usava la presence di Supabase Realtime, dove nome, foto e perfino
 * l'identificativo li scriveva il telefono. Chiunque poteva comparire a chi
 * modera come un'altra persona, e Realtime non ha modo di controllarlo.
 *
 * COSA RESTA
 *
 * Una riga per persona con l'ultima volta che si e fatta sentire, cancellata
 * dopo cinque minuti. Non c'e storico: e una fotografia di adesso.
 *
 * COSA VEDE CHI
 *
 * L'elenco lo legge solo chi modera, lo decide la funzione nel database.
 */

export type Presente = {
  utente: string;
  nome: string;
  avatar: string | null;
  /** da quando e collegato, in millisecondi */
  da: number;
};

const OGNI = 60_000;
const RILEGGI = 30_000;

let presenti: Presente[] = [];
const ascoltatori = new Set<() => void>();

function avvisa() {
  for (const f of ascoltatori) f();
}

async function ciSono() {
  await supabase?.rpc('ci_sono').then(() => {}, () => {});
}

async function meNeVado() {
  await supabase?.rpc('me_ne_vado').then(() => {}, () => {});
}

async function leggi() {
  if (!supabase) return;
  const { data, error } = await supabase.rpc('chi_ce');
  if (error) return;
  presenti = ((data ?? []) as Array<{ utente: string; nome: string; avatar: string | null; da: string }>)
    .map((r) => ({ utente: r.utente, nome: r.nome, avatar: r.avatar, da: Date.parse(r.da) }));
  avvisa();
}

/**
 * Si annuncia. Va chiamata una volta sola, in cima all'app.
 *
 * Si annuncia chiunque abbia l'app aperta e un account, da qualsiasi
 * schermata: se lo facessero solo le schermate del pannello, nell'elenco
 * comparirebbe soltanto chi lo sta guardando.
 */
export function useTracciaPresenza(): void {
  const { utente } = useSessione();

  useEffect(() => {
    if (!utente) return;

    let giro: ReturnType<typeof setInterval> | null = null;
    const accendi = () => {
      if (giro) return;
      void ciSono();
      giro = setInterval(() => { void ciSono(); }, OGNI);
    };
    const spegni = () => {
      if (giro) clearInterval(giro);
      giro = null;
      void meNeVado();
    };

    if (AppState.currentState === 'active') accendi();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') accendi();
      else spegni();
    });

    return () => { sub.remove(); spegni(); };
  }, [utente?.id]);
}

/** Legge chi c'e, ogni mezzo minuto finche una schermata del pannello e aperta. */
export function usePresenza(): { presenti: Presente[]; quanti: number } {
  const [, forza] = useState(0);

  useEffect(() => {
    const l = () => forza((n) => n + 1);
    ascoltatori.add(l);
    void leggi();
    const giro = setInterval(() => { void leggi(); }, RILEGGI);
    return () => { ascoltatori.delete(l); clearInterval(giro); };
  }, []);

  return { presenti, quanti: presenti.length };
}
