import { useSyncExternalStore } from 'react';
import type { Ionicons } from '@expo/vector-icons';

/**
 * Stanze di discussione, in stile chat.
 *
 * Nella versione precedente articoli lunghi e chiacchiere stavano nello stesso
 * elenco, e non si capiva cosa fosse cosa. Qui sono due cose separate: le stanze
 * tengono i messaggi brevi, divisi per argomento; la bacheca tiene i pezzi
 * scritti (vedi community.ts).
 *
 * Come per la bacheca non c'e nessun server: i messaggi di esempio stanno qui,
 * quelli scritti da chi prova l'app restano nel suo browser.
 */

export type Room = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  blurb: string;
};

export const ROOMS: Room[] = [
  { id: 'partita', name: 'La partita', icon: 'football', blurb: 'Prima, durante e subito dopo' },
  { id: 'formazione', name: 'Formazione', icon: 'grid', blurb: 'Chi deve giocare e perché' },
  { id: 'mercato', name: 'Mercato', icon: 'swap-horizontal', blurb: 'Entrate, uscite, voci' },
  { id: 'trasferte', name: 'Trasferte', icon: 'car-sport', blurb: 'Come ci si organizza' },
  { id: 'zaccheria', name: 'Zaccheria', icon: 'location', blurb: 'Settori, abbonamenti, biglietti' },
  { id: 'giovanili', name: 'Giovanili', icon: 'school', blurb: 'Primavera e settore giovanile' },
  { id: 'memoria', name: 'Memoria', icon: 'time', blurb: 'Le stagioni di prima' },
  { id: 'fuoritema', name: 'Fuori tema', icon: 'chatbubbles', blurb: 'Tutto il resto' },
];

export type ChatMessage = {
  id: string;
  room: string;
  author: string;
  body: string;
  /** ora del messaggio in formato HH:MM, o data breve per i piu vecchi */
  at: string;
  /** true = messaggio di esempio, non scritto da una persona vera */
  sample: boolean;
};

const s = (room: string, author: string, body: string, at: string): ChatMessage => ({
  id: `${room}-${at}-${author}`.replace(/\W/g, ''),
  room, author, body, at, sample: true,
});

const SEED: ChatMessage[] = [
  s('partita', 'Michele', 'Domenica sera alle nove, con il Cerignola. Chi c\'è?', '18:04'),
  s('partita', 'Rita', 'Io ci sono. Est come sempre.', '18:11'),
  s('partita', 'Antonio', 'Speriamo si torni a segnare, che con la Salernitana abbiamo buttato via mezza partita.', '18:26'),
  s('partita', 'Michele', 'Il problema non è creare. È chiudere.', '18:31'),
  s('partita', 'Nicola', 'Basta un gol e poi la difendiamo, che dietro stiamo messi bene.', '19:02'),

  s('formazione', 'Giuseppe', 'Secondo me Ravasio parte dalla panchina, è arrivato da tre giorni.', '10:12'),
  s('formazione', 'Francesca', 'Del Sole invece lo vedo dentro. Serve uno che salti l\'uomo.', '10:20'),
  s('formazione', 'Antonio', 'A centrocampo con Zuccon cambia parecchio, finalmente c\'è un\'alternativa.', '10:44'),
  s('formazione', 'Giuseppe', 'Io non toccherei la difesa. Una rete presa in centottanta minuti non si tocca.', '11:03'),

  s('mercato', 'Nicola', 'Chiuso con Del Sole, Ravasio e Zuccon. Onestamente meglio di come temevo a luglio.', '09:30'),
  s('mercato', 'Rita', 'Due davanti erano l\'urgenza. Adesso vediamo se si incastrano.', '09:51'),
  s('mercato', 'Michele', 'Il giudizio si dà a gennaio, non a settembre.', '10:07'),

  s('trasferte', 'Nicola', 'Monopoli il 13. Io parto dal centro e ho tre posti liberi.', 'ven'),
  s('trasferte', 'Pasquale', 'Io due, dalla zona università.', 'ven'),
  s('trasferte', 'Rita', 'Aspettiamo la comunicazione sul settore ospiti prima di prenotare.', 'sab'),

  s('zaccheria', 'Francesca', '5.329 abbonati. Per la Serie C è tanta roba.', '12:15'),
  s('zaccheria', 'Antonio', 'Vuol dire mezza gradinata già impegnata prima di cominciare.', '12:22'),
  s('zaccheria', 'Giuseppe', 'Poi però bisogna riempirla anche a novembre quando piove.', '12:40'),

  s('giovanili', 'Rita', 'Qualcuno segue la Primavera? Mi hanno detto che c\'è un centrocampista del 2008 interessante.', 'gio'),
  s('giovanili', 'Michele', 'Se cresce uno di qui vale il doppio, sempre.', 'gio'),

  s('memoria', 'Rita', 'Mi chiedono spesso com\'era negli anni di Zeman. Difficile spiegarlo senza fare il vecchio nostalgico.', 'mer'),
  s('memoria', 'Giuseppe', 'Il punto non era vincere. Era che uscivi di casa sapendo che ti saresti divertito.', 'mer'),
  s('memoria', 'Nicola', 'Non si rifà. Si racconta e basta.', 'mer'),

  s('fuoritema', 'Pasquale', 'Qualcuno sa se domenica c\'è la navetta dal centro?', '16:20'),
  s('fuoritema', 'Antonio', 'L\'anno scorso c\'era. Quest\'anno non ho visto niente.', '16:35'),
];

/* ------------------------------------------------- messaggi di chi prova l'app */

const KEY = 'daunia.rooms.v1';

function read(): ChatMessage[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

let mine: ChatMessage[] = read();
let all: ChatMessage[] = [...SEED, ...mine];
const listeners = new Set<() => void>();

function commit() {
  all = [...SEED, ...mine];
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(mine));
  } catch {
    /* niente memoria: i messaggi restano solo in questa sessione */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useMessages(): ChatMessage[] {
  return useSyncExternalStore(subscribe, () => all, () => all);
}

export function messagesOf(room: string): ChatMessage[] {
  return all.filter((m) => m.room === room);
}

export function lastOf(room: string): ChatMessage | null {
  const list = messagesOf(room);
  return list.length ? list[list.length - 1]! : null;
}

export function roomById(id: string): Room | null {
  return ROOMS.find((r) => r.id === id) ?? null;
}

export function sendMessage(room: string, author: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const now = new Date();
  mine = [...mine, {
    id: `mine-${Date.now()}`,
    room,
    author: author.trim() || 'Tu',
    body: text,
    at: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    sample: false,
  }];
  commit();
}

export function clearMine(room?: string) {
  mine = room ? mine.filter((m) => m.room !== room) : [];
  commit();
}
