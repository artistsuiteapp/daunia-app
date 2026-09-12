import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * Accorgersi che e uscita una versione nuova.
 *
 * IL PROBLEMA
 *
 * L'app aggiunta alla schermata Home dell'iPhone o al Dock del Mac riparte
 * dalla pagina che ha in memoria e non va a chiedere se ne e uscita una nuova
 * finche non la si chiude davvero dallo switcher. Chi la usa cosi puo restare
 * su una copia di tre giorni prima senza sospettarlo: si pubblica una cosa
 * nuova, e proprio la persona che la aspettava non la vede.
 *
 * COME FUNZIONA
 *
 * A ogni pubblicazione scripts/versione.mjs scrive un segnaposto in
 * /versione.json. L'app lo legge all'avvio e se lo tiene. Poi lo rilegge quando
 * torna in primo piano, e ogni tanto se resta aperta: se e cambiato, lo dice.
 *
 * NON RICARICA DA SOLA
 *
 * Una pagina che si ricarica mentre uno sta scrivendo nella Curva gli cancella
 * quello che ha scritto. Compare una riga, e ricarica chi la tocca.
 *
 * Solo sul web: l'app presa dagli store si aggiorna per conto suo.
 */

const web = Platform.OS === 'web';
/* mezz'ora: abbastanza per accorgersene durante una partita, abbastanza poco
 * da non essere una richiesta ogni due minuti per niente */
const OGNI = 30 * 60 * 1000;

let partitaCon: string | null = null;
let nuova = false;
const ascoltatori = new Set<() => void>();

async function leggi(): Promise<string | null> {
  try {
    // no-store, altrimenti si chiede al server e risponde la cache del browser
    // con lo stesso file di prima: sarebbe come non aver chiesto niente
    const r = await fetch('/versione.json', { cache: 'no-store' });
    if (!r.ok) return null;
    const d = (await r.json()) as { versione?: string };
    return d.versione ?? null;
  } catch {
    return null;
  }
}

async function controlla() {
  if (!web || nuova) return;
  const v = await leggi();
  if (!v) return;
  if (partitaCon == null) { partitaCon = v; return; }
  if (v !== partitaCon) {
    nuova = true;
    for (const f of ascoltatori) f();
  }
}

/** Vero quando sul sito c'e una versione piu nuova di quella aperta. */
export function useVersioneNuova(): boolean {
  const [v, setV] = useState(nuova);

  useEffect(() => {
    if (!web) return;
    const l = () => setV(nuova);
    ascoltatori.add(l);

    void controlla();
    const orologio = setInterval(() => { void controlla(); }, OGNI);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void controlla();
    });

    return () => {
      ascoltatori.delete(l);
      clearInterval(orologio);
      sub.remove();
    };
  }, []);

  return v;
}

export function ricarica() {
  if (web && typeof location !== 'undefined') location.reload();
}
