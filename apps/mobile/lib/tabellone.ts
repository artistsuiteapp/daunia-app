import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';
import type { FormazioneVivo, GolAnnullato, GolVivo } from './live';
import type { Lato } from './tabellone-core';

/**
 * Il tabellone a mano, dal lato dell'app.
 *
 * PERCHE ESISTE
 *
 * Le fonti dal vivo hanno un ritardo che non dipende da noi: il 15 settembre i
 * gol arrivavano con qualche minuto e le formazioni con cinquanta. Chi e allo
 * stadio, o davanti alla partita, sa tutto prima -- e quello che sa puo
 * scriverlo qui, per tutti.
 *
 * PERCHE PASSA DA UNA FUNZIONE DEL DATABASE
 *
 * `stato_partita` non ha nessuna politica di scrittura: la riga la tocca solo
 * il guardiano. Un UPDATE dal client non darebbe errore, darebbe zero righe
 * cambiate -- il tasto sembrerebbe funzionare e non succederebbe niente. La
 * funzione `tabellone_a_mano` controlla il ruolo e risponde con un errore
 * vero, come tutto il resto del pannello.
 *
 * La riga si legge qui e non da `live.ts` perche il pannello si apre anche
 * un'ora prima del fischio, quando il dal vivo dell'app e ancora spento.
 */

export type RigaTabellone = {
  partita: string;
  stato: string | null;
  minuto: string | null;
  casa: number | null;
  ospiti: number | null;
  recupero: number | null;
  manuale: boolean;
  gol: GolVivo[];
  annullati: GolAnnullato[];
  formazione: FormazioneVivo | null;
  /** quello che vedono le fonti: il confronto per chi sta segnando a mano */
  fonti: { casa: number | null; ospiti: number | null };
  finitaIl: string | null;
};

const COLONNE = 'partita, stato, minuto, casa, ospiti, recupero, manuale, gol, annullati, '
  + 'formazione, casa_fonti, ospiti_fonti, finita_il';

function daRiga(r: Record<string, unknown>): RigaTabellone {
  return {
    partita: String(r.partita),
    stato: (r.stato as string | null) ?? null,
    minuto: (r.minuto as string | null) ?? null,
    casa: (r.casa as number | null) ?? null,
    ospiti: (r.ospiti as number | null) ?? null,
    recupero: (r.recupero as number | null) ?? null,
    manuale: r.manuale === true,
    gol: (r.gol as GolVivo[] | null) ?? [],
    annullati: (r.annullati as GolAnnullato[] | null) ?? [],
    formazione: (r.formazione as FormazioneVivo | null) ?? null,
    fonti: {
      casa: (r.casa_fonti as number | null) ?? null,
      ospiti: (r.ospiti_fonti as number | null) ?? null,
    },
    finitaIl: (r.finita_il as string | null) ?? null,
  };
}

/** Ogni quanto si rilegge la riga: Realtime la porta da solo, questa e la rete. */
const RILEGGI = 15_000;

/**
 * La riga della partita, sempre aggiornata.
 *
 * Realtime la porta appena cambia -- anche quando a cambiarla e il guardiano,
 * quindi chi sta segnando vede arrivare i gol delle fonti mentre segna i suoi.
 * La rilettura ogni quindici secondi resta come rete: sul telefono un canale
 * puo cadere senza dirlo, e qui si sta scrivendo il risultato per tutti.
 */
export function useTabellone(partita: string | null): {
  riga: RigaTabellone | null; caricato: boolean; ricarica: () => Promise<void>;
} {
  const [riga, setRiga] = useState<RigaTabellone | null>(null);
  const [caricato, setCaricato] = useState(false);

  const ricarica = useCallback(async () => {
    if (!supabase || !partita) { setCaricato(true); return; }
    const { data } = await supabase.from('stato_partita').select(COLONNE)
      .eq('partita', partita).maybeSingle();
    if (data) setRiga(daRiga(data as unknown as Record<string, unknown>));
    setCaricato(true);
  }, [partita]);

  useEffect(() => {
    let vivo = true;
    void ricarica();
    const t = setInterval(() => { if (vivo) void ricarica(); }, RILEGGI);

    if (!supabase || !partita) return () => { vivo = false; clearInterval(t); };
    const client = supabase;
    // nome unico: un canale con lo stesso nome ancora in uscita verrebbe
    // restituito com'e, e l'iscrizione nuova non partirebbe (vedi live.ts)
    const canale = client
      .channel(`tabellone-${partita}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stato_partita', filter: `partita=eq.${partita}` },
        (m) => { if (vivo) setRiga(daRiga(m.new as Record<string, unknown>)); },
      )
      .subscribe();

    return () => {
      vivo = false;
      clearInterval(t);
      void client.removeChannel(canale);
    };
  }, [partita, ricarica]);

  return { riga, caricato, ricarica };
}

export type Esito = { ok: boolean; messaggio: string };

type Azione = 'accendi' | 'spegni' | 'gol' | 'annulla' | 'punteggio' | 'recupero' | 'stato' | 'fine';

type Dati = {
  lato?: Lato;
  nostro?: boolean;
  chi?: string | null;
  minuto?: number | null;
  casa?: number;
  ospiti?: number;
  voce?: string | null;
  valore?: number | null;
  stato?: string;
};

/**
 * Il messaggio del database e gia in italiano e gia chiaro: si mostra quello,
 * senza il prefisso tecnico che Postgres ci mette davanti.
 */
function daErrore(messaggio: string | undefined): Esito {
  return { ok: false, messaggio: messaggio?.replace(/^.*?:\s*/, '') || 'Non è riuscito. Riprova.' };
}

async function chiama(partita: string, azione: Azione, d: Dati = {}): Promise<Esito> {
  if (!supabase) return { ok: false, messaggio: 'Non c’è collegamento.' };
  const { error } = await supabase.rpc('tabellone_a_mano', {
    p_partita: partita,
    p_azione: azione,
    p_lato: d.lato ?? null,
    p_nostro: d.nostro ?? null,
    p_chi: d.chi ?? null,
    p_minuto: d.minuto ?? null,
    p_casa: d.casa ?? null,
    p_ospiti: d.ospiti ?? null,
    p_voce: d.voce ?? null,
    p_valore: d.valore ?? null,
    p_stato: d.stato ?? null,
  });
  return error ? daErrore(error.message) : { ok: true, messaggio: '' };
}

export const accendiTabellone = (p: string) => chiama(p, 'accendi');
export const spegniTabellone = (p: string) => chiama(p, 'spegni');

export const segnaGol = (
  p: string, lato: Lato, nostro: boolean, chi: string | null, minuto: number | null,
) => chiama(p, 'gol', { lato, nostro, chi, minuto });

export const annullaGol = (p: string, voce: string | null, lato: Lato, minuto: number | null) =>
  chiama(p, 'annulla', { voce, lato, minuto });

export const correggiPunteggio = (p: string, casa: number, ospiti: number) =>
  chiama(p, 'punteggio', { casa, ospiti });

export const impostaRecupero = (p: string, minuti: number | null) =>
  chiama(p, 'recupero', { valore: minuti });

export const cambiaFase = (p: string, stato: string) => chiama(p, 'stato', { stato });

export const chiudiPartita = (p: string) => chiama(p, 'fine');
