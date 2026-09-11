import { useEffect, useState } from 'react';

import { supabase } from './supabase';
import { useSessione, utenteCorrente } from './auth';
import { scorePrediction } from './prediction-score';

/**
 * I propri pronostici, con com'e' andata.
 *
 * DA DOVE VIENE OGNI PEZZO
 *
 * Il pronostico e' nostro e si legge dalla tabella. Il risultato vero sta in
 * `partite_chiuse`, che e' pubblica. I punti stanno nei movimenti, che sono
 * solo propri. Tre letture e non una join lato server: sono poche righe, e
 * tenerle separate vuol dire che nessuna delle tre puo far uscire dati altrui.
 *
 * L'esito NON si ricalcola qui per decidere quanto vale: quello lo ha gia'
 * deciso il database quando la partita e' stata chiusa, e i punti sono quelli
 * registrati. Qui si ricalcola solo per dire "ci avevi preso" anche nel caso in
 * cui i punti non ci siano ancora, o siano stati presi prima di un cambio di
 * tariffa.
 */

export type MioPronostico = {
  partita: string;
  casa: number;
  ospiti: number;
  /** null finche' la partita non e' chiusa */
  risultato: { casa: number; ospiti: number } | null;
  /** 0 niente, 1 esito, 3 risultato esatto -- la scala di prediction-score */
  bonta: 0 | 1 | 3 | null;
  /** i punti davvero registrati per quella partita */
  punti: number;
};

export async function caricaMieiPronostici(): Promise<MioPronostico[]> {
  const u = utenteCorrente();
  if (!supabase || !u) return [];

  const { data: miei } = await supabase
    .from('pronostici')
    .select('partita, casa, ospiti')
    .eq('utente', u.id);

  const righe = (miei ?? []) as Array<{ partita: string; casa: number; ospiti: number }>;
  if (righe.length === 0) return [];

  const ids = righe.map((r) => r.partita);
  const [{ data: chiuse }, { data: movimenti }] = await Promise.all([
    supabase.from('partite_chiuse').select('partita, casa, ospiti').in('partita', ids),
    supabase.from('punti_movimenti').select('chiave, punti, azione')
      .eq('utente', u.id).in('chiave', ids),
  ]);

  const finite = new Map<string, { casa: number; ospiti: number }>();
  for (const c of ((chiuse ?? []) as Array<{ partita: string; casa: number; ospiti: number }>)) {
    finite.set(c.partita, { casa: Number(c.casa), ospiti: Number(c.ospiti) });
  }

  const puntiPer = new Map<string, number>();
  for (const m of ((movimenti ?? []) as Array<{ chiave: string; punti: number; azione: string }>)) {
    // il punto del pronostico messo non c'entra con l'averci preso: qui si
    // contano solo i premi dell'esito e del risultato
    if (m.azione !== 'esito' && m.azione !== 'risultato') continue;
    puntiPer.set(m.chiave, (puntiPer.get(m.chiave) ?? 0) + Number(m.punti));
  }

  return righe.map((r) => {
    const vero = finite.get(r.partita) ?? null;
    return {
      partita: r.partita,
      casa: Number(r.casa),
      ospiti: Number(r.ospiti),
      risultato: vero,
      bonta: vero ? scorePrediction([Number(r.casa), Number(r.ospiti)], { home: vero.casa, away: vero.ospiti }) : null,
      punti: puntiPer.get(r.partita) ?? 0,
    };
  });
}

/** Quante ne ha indovinate di fila, contate dal database. */
export async function caricaMiaStriscia(): Promise<number> {
  if (!supabase || !utenteCorrente()) return 0;
  const { data, error } = await supabase.rpc('mia_striscia');
  return error ? 0 : Number(data ?? 0);
}

export function useMieiPronostici() {
  const { utente } = useSessione();
  const [righe, setRighe] = useState<MioPronostico[]>([]);
  const [striscia, setStriscia] = useState(0);
  const [caricato, setCaricato] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!utente) { setRighe([]); setStriscia(0); setCaricato(true); return; }
    setCaricato(false);
    void Promise.all([caricaMieiPronostici(), caricaMiaStriscia()]).then(([p, s]) => {
      if (!vivo) return;
      setRighe(p);
      setStriscia(s);
      setCaricato(true);
    });
    return () => { vivo = false; };
  }, [utente?.id]);

  const chiusi = righe.filter((r) => r.risultato);
  const presi = chiusi.filter((r) => (r.bonta ?? 0) > 0).length;
  const esatti = chiusi.filter((r) => r.bonta === 3).length;

  return { righe, striscia, caricato, giocati: righe.length, chiusi: chiusi.length, presi, esatti };
}
