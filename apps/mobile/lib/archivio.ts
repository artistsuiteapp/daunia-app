import { useEffect, useState } from 'react';

import { supabase } from './supabase';
import { useSessione } from './auth';

/**
 * L'archivio delle pagelle: com'e andata in ogni partita giocata.
 *
 * SI CHIEDE UNA VOLTA SOLA PER TUTTE LE PARTITE
 *
 * La vista delle medie risponde per una gara alla volta, ed e giusta per la
 * scheda di quella gara. Per l'elenco di una stagione intera sarebbero quaranta
 * chiamate per disegnare una lista: gli id li conosce l'app, che ha il
 * calendario, e li passa tutti insieme a `pagelle_riassunto`.
 *
 * Da qui escono solo numeri contati. I voti singoli non escono mai, come nel
 * resto delle pagelle: chi ha dato 4 a chi resta suo.
 */

export type RiassuntoPagelle = {
  partita: string;
  /** media della squadra in quella partita */
  media: number;
  /** quante persone hanno votato */
  votanti: number;
  /** quanti voti in tutto: una persona ne da uno per giocatore */
  voti: number;
  /** null quando nessuno ha raggiunto i tre voti minimi */
  migliore: string | null;
  mediaMigliore: number | null;
};

export async function caricaArchivioPagelle(partite: string[]): Promise<RiassuntoPagelle[]> {
  if (!supabase || partite.length === 0) return [];
  const { data, error } = await supabase.rpc('pagelle_riassunto', { p_partite: partite });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    partita: String(r.partita),
    media: Number(r.media),
    votanti: Number(r.votanti),
    voti: Number(r.voti),
    migliore: (r.migliore as string | null) ?? null,
    mediaMigliore: r.media_migliore === null || r.media_migliore === undefined
      ? null
      : Number(r.media_migliore),
  }));
}

/**
 * L'archivio indicizzato per partita.
 *
 * Una mappa e non un elenco perche chi disegna la lista ha gia le partite dal
 * calendario e vuole solo sapere, per ognuna, se c'e qualcosa da dire.
 */
export function useArchivioPagelle(partite: string[]) {
  const { utente } = useSessione();
  const [per, setPer] = useState<Record<string, RiassuntoPagelle>>({});
  const [caricato, setCaricato] = useState(false);

  // la chiave e la lista, non l'array: un array nuovo a ogni disegno
  // rifarebbe la chiamata per sempre
  const chiave = partite.join(',');

  useEffect(() => {
    let vivo = true;
    setCaricato(false);
    void caricaArchivioPagelle(chiave ? chiave.split(',') : []).then((righe) => {
      if (!vivo) return;
      setPer(Object.fromEntries(righe.map((r) => [r.partita, r])));
      setCaricato(true);
    });
    return () => { vivo = false; };
  }, [chiave, utente?.id]);

  return { per, caricato };
}
