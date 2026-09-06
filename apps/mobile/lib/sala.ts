/**
 * La chat della partita.
 *
 * Esiste solo mentre si gioca. Fuori da quella finestra la voce non compare
 * nemmeno: una stanza vuota il martedi non e neutra, e la prova che non c'e
 * nessuno, e chi ci entra una volta non torna.
 *
 * Legge chiunque, scrive solo chi ha un account. Guardare gli altri commentare
 * un derby e il motivo migliore per iscriversi che questa app abbia.
 *
 * I messaggi nuovi arrivano da soli via Realtime, senza ricaricare: durante una
 * partita nessuno tira giu la pagina per aggiornare.
 */
import { useEffect, useSyncExternalStore } from 'react';

import { supabase } from './supabase';
import { utenteCorrente } from './auth';
import { chatAperta } from './live-core.ts';
import { prossima } from './data';
import { fineVera } from './live';

export type Messaggio = {
  id: string;
  partita: string;
  utente: string;
  testo: string;
  creato_il: string;
  autore: string;
  avatar: string | null;
};

export const LIMITE = 300;

type Store = { per: Record<string, Messaggio[]>; caricata: string | null };
let store: Store = { per: {}, caricata: null };
const ascoltatori = new Set<() => void>();
const annuncia = () => ascoltatori.forEach((f) => f());

type Riga = {
  id: string; partita: string; utente: string; testo: string; creato_il: string;
  profiles?: { nome?: string | null; avatar?: string | null } | null;
};

const daRiga = (r: Riga): Messaggio => ({
  id: r.id,
  partita: r.partita,
  utente: r.utente,
  testo: r.testo,
  creato_il: r.creato_il,
  autore: r.profiles?.nome ?? 'Tifoso',
  avatar: r.profiles?.avatar ?? null,
});

/**
 * Vero se adesso la chat ha senso.
 *
 * Dieci minuti prima del fischio, e fino a venti minuti dopo il triplice vero.
 * Non dopo un orario calcolato dal calcio d'inizio: fra recuperi e ritardi
 * ballano dieci minuti, e sono quelli in cui si commenta la partita appena
 * finita.
 */
export function salaAperta(kickoff?: string | null, adesso = Date.now()): boolean {
  return chatAperta(kickoff ?? prossima?.kickoff, fineVera(), adesso);
}

async function carica(partita: string) {
  if (!supabase) return;
  const { data } = await supabase
    .from('messaggi_live')
    .select('id, partita, utente, testo, creato_il, profiles(nome, avatar)')
    .eq('partita', partita)
    .order('creato_il', { ascending: true })
    .limit(300);
  store = { per: { ...store.per, [partita]: (data ?? []).map((r) => daRiga(r as unknown as Riga)) }, caricata: partita };
  annuncia();
}

/**
 * Aggancia la schermata e tiene aperto il canale dei messaggi nuovi.
 *
 * Il canale si chiude quando si esce: lasciarlo aperto terrebbe sveglia la
 * connessione anche a partita finita, e su un telefono si sente.
 */
export function useSala(partita: string | null): Messaggio[] {
  useEffect(() => {
    if (!partita || !supabase) return;
    void carica(partita);

    const canale = supabase
      .channel(`sala-${partita}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messaggi_live', filter: `partita=eq.${partita}` },
        async (evento) => {
          const nuovo = evento.new as Riga;
          // l'evento non porta il nome di chi scrive: si chiede al volo, una
          // volta sola per messaggio
          const { data } = await supabase!
            .from('profiles').select('nome, avatar').eq('id', nuovo.utente).maybeSingle();
          const m = daRiga({ ...nuovo, profiles: data as { nome?: string; avatar?: string } | null });
          const attuali = store.per[partita] ?? [];
          if (attuali.some((x) => x.id === m.id)) return;
          store = { ...store, per: { ...store.per, [partita]: [...attuali, m] } };
          annuncia();
        },
      )
      .subscribe();

    return () => { void supabase?.removeChannel(canale); };
  }, [partita]);

  return useSyncExternalStore(
    (f) => { ascoltatori.add(f); return () => { ascoltatori.delete(f); }; },
    () => (partita ? store.per[partita] ?? VUOTO : VUOTO),
    () => (partita ? store.per[partita] ?? VUOTO : VUOTO),
  );
}

const VUOTO: Messaggio[] = [];

/** Manda un messaggio. Il filtro vero e il trigger nel database. */
export async function manda(partita: string, testo: string) {
  const t = testo.trim();
  if (!t) return;
  const u = await utenteCorrente();
  if (!supabase || !u) throw new Error('Per scrivere nella chat serve un account.');

  const { error } = await supabase.from('messaggi_live').insert({
    partita, utente: u.id, testo: t.slice(0, LIMITE),
  });
  if (error) {
    if (error.message.includes('bestemmia')) throw new Error('Qui le bestemmie non passano. Riscrivi senza.');
    if (error.message.includes('parolaccia')) throw new Error('C\'è una parola che qui non passa. Riscrivi.');
    throw new Error(error.message);
  }
}

/** Cancella un proprio messaggio. Modificare non si puo, ed e voluto. */
export async function cancella(partita: string, id: string) {
  if (!supabase) return;
  await supabase.from('messaggi_live').delete().eq('id', id);
  store = {
    ...store,
    per: { ...store.per, [partita]: (store.per[partita] ?? []).filter((m) => m.id !== id) },
  };
  annuncia();
}
