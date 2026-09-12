/**
 * Rassegna stampa: le testate che ci hanno dato il permesso.
 *
 * Qui non si legge niente per intero. Titolo, sommario, data — e il tocco porta
 * fuori, sul sito di chi l'ha scritto. E la condizione a cui hanno detto di si,
 * e vale piu di qualunque comodita di lettura che potremmo aggiungere.
 */
import type { ArticoloStampa, Testata } from '@satanelli/core';

import { stampa } from './data';

/*
 * I dati arrivano da data.ts e non piu da un import del JSON.
 *
 * Con l'import diretto la rassegna restava quella del giorno in cui l'app era
 * stata compilata: le testate pubblicavano, il telefono no. Da data.ts invece
 * segue il bundle scaricato a ogni apertura.
 *
 * Per lo stesso motivo qui non ci sono piu costanti calcolate una volta sola:
 * sono funzioni, cosi rileggono i valori aggiornati invece di fissare quelli
 * del primo avvio.
 */

export function testate(): Testata[] {
  return stampa.testate ?? [];
}

/** Tutti gli articoli, dal piu recente. */
export function articoliStampa(): ArticoloStampa[] {
  return [...(stampa.articoli ?? [])]
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

export function testataPerId(id: string): Testata | null {
  return testate().find((t) => t.id === id) ?? null;
}

export function articoliDi(id: string): ArticoloStampa[] {
  return articoliStampa().filter((a) => a.testata === id);
}

/**
 * Cosa mostrare sul banner di una testata: quanti pezzi e quanto e fresco.
 *
 * Una testata senza articoli non e un errore da nascondere — puo essere un feed
 * che ha smesso di rispondere — quindi torna comunque, con zero.
 */
export function riepilogo(id: string): { quanti: number; ultimo: string | null } {
  const suoi = articoliDi(id);
  return { quanti: suoi.length, ultimo: suoi[0]?.data ?? null };
}

/** Le testate che hanno almeno un articolo, cioe quelle da disegnare. */
export function testateConArticoli(): Testata[] {
  return testate().filter((t) => articoliDi(t.id).length > 0);
}
