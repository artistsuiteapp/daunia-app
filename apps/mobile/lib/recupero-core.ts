/**
 * Cosa porta con se il collegamento dell'email di recupero.
 *
 * Il collegamento passa da Supabase e torna all'app con i dati di accesso in
 * coda all'indirizzo: dopo il cancelletto (`#access_token=...&type=recovery`)
 * nel flusso "implicit", oppure come `?code=` nel flusso PKCE. Se il
 * collegamento e scaduto o gia usato, al loro posto c'e `error_description`.
 *
 * Sul web li legge da solo supabase-js. Sul telefono l'indirizzo arriva come
 * `daunia://nuova-password#...` e nessuno lo guardava: chi apriva l'email
 * finiva nell'app senza sessione e senza un posto dove scrivere la password
 * nuova. Qui solo la lettura, senza rete, cosi si prova.
 */

export type ParametriRecupero = {
  accesso: string | null;
  rinnovo: string | null;
  codice: string | null;
  tipo: string | null;
  errore: string | null;
};

function leggi(pezzo: string): Map<string, string> {
  const fuori = new Map<string, string>();
  for (const coppia of pezzo.split('&')) {
    if (!coppia) continue;
    const i = coppia.indexOf('=');
    const chiave = i < 0 ? coppia : coppia.slice(0, i);
    const valore = i < 0 ? '' : coppia.slice(i + 1);
    try {
      fuori.set(decodeURIComponent(chiave), decodeURIComponent(valore.replace(/\+/g, ' ')));
    } catch {
      // una coppia codificata male non deve far perdere le altre
    }
  }
  return fuori;
}

export function parametriRecupero(url: string | null | undefined): ParametriRecupero {
  const vuoto: ParametriRecupero = { accesso: null, rinnovo: null, codice: null, tipo: null, errore: null };
  if (typeof url !== 'string' || !url) return vuoto;

  const cancelletto = url.indexOf('#');
  const domanda = url.indexOf('?');
  const query = domanda < 0 ? '' : url.slice(domanda + 1, cancelletto > domanda ? cancelletto : undefined);
  const frammento = cancelletto < 0 ? '' : url.slice(cancelletto + 1);

  // il frammento vince: e dove il flusso implicit mette i dati veri
  const tutti = new Map([...leggi(query), ...leggi(frammento)]);
  const valore = (k: string) => {
    const v = tutti.get(k)?.trim();
    return v ? v : null;
  };

  return {
    accesso: valore('access_token'),
    rinnovo: valore('refresh_token'),
    codice: valore('code'),
    tipo: valore('type'),
    errore: valore('error_description') ?? valore('error'),
  };
}

/** Un messaggio per chi legge, non il testo tecnico di Supabase. */
export function erroreRecupero(p: ParametriRecupero): string | null {
  if (!p.errore) return null;
  if (/expired|invalid|scadut/i.test(p.errore)) {
    return 'Il collegamento è scaduto o è già stato usato. Chiedine uno nuovo.';
  }
  return 'Il collegamento non funziona. Chiedine uno nuovo.';
}
