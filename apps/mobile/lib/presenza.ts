import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from './supabase';
import { useSessione, utenteCorrente } from './auth';
import type { Ruolo } from './moderazione';

/**
 * Chi c'e adesso.
 *
 * COME FUNZIONA
 *
 * Supabase Realtime tiene un elenco vivo di chi e collegato a un canale
 * (presence). Non e una tabella: non si scrive niente, non resta niente. Chi
 * chiude l'app sparisce da solo dopo qualche secondo, anche se il telefono si
 * e spento di colpo.
 *
 * PERCHE SI STACCA QUANDO L'APP VA IN SECONDO PIANO
 *
 * Un collegamento aperto consuma batteria e rete. Fuori dallo schermo non
 * serve a niente: si stacca, e si riattacca da solo quando si torna. Senza
 * questo, "quanti sono online" conterebbe anche telefoni in tasca da tre ore.
 *
 * COSA VEDE CHI
 *
 * Il numero lo vedono tutti. I nomi servono a chi modera, per sapere con chi
 * ha a che fare mentre la chat corre. Sono nomi gia pubblici in tutta l'app:
 * qui non si scopre niente di nuovo, si mette in fila.
 */

export type Presente = {
  utente: string;
  nome: string;
  avatar: string | null;
  ruolo: Ruolo;
  /** da quando e collegato, in millisecondi */
  da: number;
};

const CANALE = 'presenza';

let canale: RealtimeChannel | null = null;
let presenti: Presente[] = [];
let quantiUsano = 0;
const ascoltatori = new Set<() => void>();

function avvisa() {
  for (const f of ascoltatori) f();
}

function leggi() {
  if (!canale) return;
  const stato = canale.presenceState<Presente>();
  const visti = new Map<string, Presente>();
  for (const lista of Object.values(stato)) {
    for (const p of lista) {
      if (!p?.utente) continue;
      // stessa persona su due dispositivi: conta una volta, dal piu vecchio
      const gia = visti.get(p.utente);
      if (!gia || p.da < gia.da) visti.set(p.utente, p);
    }
  }
  presenti = [...visti.values()].sort((a, b) => a.da - b.da);
  avvisa();
}

async function attacca() {
  if (canale || !supabase) return;
  const io = utenteCorrente();

  canale = supabase.channel(CANALE, {
    config: { presence: { key: io?.id ?? `ospite-${Math.random().toString(36).slice(2)}` } },
  });

  canale
    .on('presence', { event: 'sync' }, leggi)
    .on('presence', { event: 'join' }, leggi)
    .on('presence', { event: 'leave' }, leggi)
    .subscribe(async (stato) => {
      if (stato !== 'SUBSCRIBED' || !io) return;
      // solo chi ha un account si annuncia: un ospite guarda e basta
      const { data } = await supabase!
        .from('profiles').select('nome, avatar, ruolo').eq('id', io.id).maybeSingle();
      await canale?.track({
        utente: io.id,
        nome: (data?.nome as string) ?? 'Tifoso',
        avatar: (data?.avatar as string | null) ?? null,
        ruolo: ((data?.ruolo as Ruolo) ?? 'utente'),
        da: Date.now(),
      });
    });
}

async function stacca() {
  const c = canale;
  canale = null;
  presenti = [];
  avvisa();
  if (c) await supabase?.removeChannel(c);
}

/**
 * Il numero di chi e collegato, e l'elenco.
 *
 * Il canale si apre quando la prima schermata lo chiede e si chiude quando
 * l'ultima se ne va: due schermate aperte insieme non aprono due canali.
 */
/**
 * Si annuncia. Va chiamata una volta sola, in cima all'app.
 *
 * QUI STAVA IL MOTIVO PER CUI NON SI VEDEVA MAI NESSUNO
 *
 * Il canale si apriva dentro le due schermate del pannello. Quindi comparivi
 * nell'elenco solo mentre stavi guardando l'elenco, e per vedere qualcun altro
 * sarebbe servito che anche lui, nello stesso momento, fosse fermo sulla stessa
 * schermata da amministratore. In pratica: sempre vuoto, o solo te stesso.
 *
 * Adesso si annuncia chiunque abbia l'app aperta e un account, da qualsiasi
 * schermata. Il pannello si limita a leggere.
 */
export function useTracciaPresenza(): void {
  const { utente } = useSessione();

  useEffect(() => {
    if (!utente) { void stacca(); return; }
    void attacca();

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void attacca();
      else void stacca();
    });

    return () => { sub.remove(); void stacca(); };
  }, [utente?.id]);
}

/** Legge chi c'e. Non apre niente: il canale lo tiene aperto useTracciaPresenza. */
export function usePresenza(): { presenti: Presente[]; quanti: number } {
  const [, forza] = useState(0);

  useEffect(() => {
    const l = () => forza((n) => n + 1);
    ascoltatori.add(l);
    l();
    return () => { ascoltatori.delete(l); };
  }, []);

  return { presenti, quanti: presenti.length };
}
