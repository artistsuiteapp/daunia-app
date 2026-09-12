import { useEffect, useState } from 'react';

import { supabase } from './supabase';
import { livelloDi, type Livello } from './match-center-core.ts';
import type { Ruolo } from './moderazione';

/**
 * Chi e chi: nome, ruolo, punti e livello di chiunque compaia in una schermata.
 *
 * PERCHE NON UNA CHIAMATA PER NOME
 *
 * Una discussione lunga ha venti nomi diversi. Chiedere i punti uno per uno
 * vorrebbe dire venti chiamate mentre si scorre, e la lista che si ferma. Qui
 * gli identificativi si accumulano per un attimo e partono tutti insieme:
 * venti nomi, una chiamata.
 *
 * PERCHE UNA CACHE
 *
 * Lo stesso nome compare nella lista, dentro la discussione e in chat. I punti
 * di una persona non cambiano fra una schermata e l'altra, quindi si chiedono
 * una volta per apertura dell'app e poi si leggono da qui. Chi entra in
 * classifica vede i suoi punti freschi, che e il posto dove contano.
 */

export type Identita = {
  utente: string;
  nome: string;
  avatar: string | null;
  ruolo: Ruolo;
  punti: number;
  livello: Livello;
};

const cache = new Map<string, Identita>();
const ascoltatori = new Set<() => void>();
/** chiesti e non ancora tornati: senza, la stessa persona parte due volte */
const inVolo = new Set<string>();
let coda = new Set<string>();
let partenza: ReturnType<typeof setTimeout> | null = null;

function avvisa() {
  for (const f of ascoltatori) f();
}

async function svuotaLaCoda() {
  partenza = null;
  const ids = [...coda];
  coda = new Set();
  if (!ids.length || !supabase) return;

  for (const id of ids) inVolo.add(id);
  const { data } = await supabase.rpc('identita', { p_utenti: ids });

  for (const r of ((data ?? []) as Array<Record<string, unknown>>)) {
    const punti = Number(r.punti ?? 0);
    cache.set(String(r.utente), {
      utente: String(r.utente),
      nome: String(r.nome ?? 'Tifoso'),
      avatar: (r.avatar as string | null) ?? null,
      ruolo: ((r.ruolo as Ruolo | null) ?? 'utente'),
      punti,
      livello: livelloDi(punti),
    });
  }
  for (const id of ids) inVolo.delete(id);
  avvisa();
}

/**
 * Mette in coda quello che non si sa ancora.
 *
 * I venti millisecondi servono a far arrivare tutte le righe di una lista
 * prima di partire: React le monta una dopo l'altra nello stesso fotogramma.
 */
export function chiedi(ids: Array<string | null | undefined>) {
  let nuovo = false;
  for (const id of ids) {
    if (!id || cache.has(id) || inVolo.has(id) || coda.has(id)) continue;
    coda.add(id);
    nuovo = true;
  }
  if (!nuovo || partenza) return;
  partenza = setTimeout(() => { void svuotaLaCoda(); }, 20);
}

export function identitaNota(id: string | null | undefined): Identita | null {
  return id ? cache.get(id) ?? null : null;
}

/** Da chiamare dopo un cambio di ruolo o una sospensione: la cache e vecchia. */
export function dimentica(id?: string) {
  if (id) cache.delete(id); else cache.clear();
  avvisa();
}

/**
 * L'identita di una persona, quando arriva.
 *
 * Finche non e arrivata torna null e chi la usa mostra il nome che ha gia: il
 * nome non deve mai sparire in attesa dei punti.
 */
export function useIdentita(id: string | null | undefined): Identita | null {
  const [, forza] = useState(0);

  useEffect(() => {
    const l = () => forza((n) => n + 1);
    ascoltatori.add(l);
    return () => { ascoltatori.delete(l); };
  }, []);

  useEffect(() => { chiedi([id]); }, [id]);

  return identitaNota(id);
}

/* ------------------------------------------------------------ scheda pubblica */

export type BadgePreso = { codice: string; nome: string; icona: string; presoIl: string };

export type ProfiloPubblico = {
  utente: string;
  nome: string;
  avatar: string | null;
  bio: string | null;
  ruolo: Ruolo;
  punti: number;
  iscrittoIl: string;
  badge: BadgePreso[];
};

/**
 * La scheda di una persona: quello che si vede toccando un nome.
 *
 * Passa da una funzione sola invece che da quattro letture perche una scheda
 * che si riempie a pezzi, uno dopo l'altro, sembra rotta anche quando non lo e.
 */
export async function caricaProfiloPubblico(id: string): Promise<ProfiloPubblico | null> {
  if (!supabase) return null;
  const { data } = await supabase.rpc('profilo_pubblico', { chi: id });
  const r = (data as Array<Record<string, unknown>> | null)?.[0];
  if (!r) return null;
  return {
    utente: String(r.utente),
    nome: String(r.nome ?? 'Tifoso'),
    avatar: (r.avatar as string | null) ?? null,
    bio: (r.bio as string | null) ?? null,
    ruolo: ((r.ruolo as Ruolo | null) ?? 'utente'),
    punti: Number(r.punti ?? 0),
    iscrittoIl: String(r.iscritto_il),
    badge: ((r.badge as BadgePreso[] | null) ?? []),
  };
}

export function useProfiloPubblico(id: string | null | undefined) {
  const [scheda, setScheda] = useState<ProfiloPubblico | null>(null);
  const [caricato, setCaricato] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCaricato(false);
    if (!id) { setScheda(null); setCaricato(true); return; }
    void caricaProfiloPubblico(id).then((s) => {
      if (!vivo) return;
      setScheda(s);
      setCaricato(true);
    });
    return () => { vivo = false; };
  }, [id]);

  return { scheda, caricato };
}
