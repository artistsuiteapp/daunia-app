/**
 * Contatti per organizzarsi: dall'app si esce, non si chatta dentro.
 *
 * Qui si trasforma quello che una persona scrive ("+39 349 1234567", "@marco",
 * "marco@posta.it") in un collegamento che apre l'applicazione giusta. Niente
 * React e niente rete: sono conti, e i conti si provano.
 *
 * Il numero di telefono e la parte che si sbaglia. La gente lo scrive in dieci
 * modi diversi, e un link costruito male porta a una conversazione con uno
 * sconosciuto: peggio che non avere il pulsante.
 */

export type Canale = 'whatsapp' | 'telegram' | 'email' | 'instagram';

export const CANALI: Record<Canale, { nome: string; icona: string; esempio: string }> = {
  whatsapp: { nome: 'WhatsApp', icona: 'logo-whatsapp', esempio: '349 1234567' },
  telegram: { nome: 'Telegram', icona: 'paper-plane', esempio: '@iltuonome' },
  email: { nome: 'Email', icona: 'mail', esempio: 'nome@posta.it' },
  instagram: { nome: 'Instagram', icona: 'logo-instagram', esempio: '@iltuonome' },
};

/**
 * Numero italiano in cifre pronte per wa.me.
 *
 * Le forme che arrivano davvero: "349 123 4567", "+39 3491234567",
 * "0039 349...", "349-1234567". Si tolgono i segni, si normalizza il prefisso
 * internazionale, e se manca lo si mette solo quando la lunghezza e quella di
 * un cellulare italiano. Su un numero che non riconosce non tira a indovinare:
 * risponde null, e la schermata chiede di ricontrollarlo.
 */
export function numeroWhatsapp(grezzo: string): string | null {
  let n = String(grezzo ?? '').replace(/[^\d+]/g, '');
  if (!n) return null;

  if (n.startsWith('00')) n = `+${n.slice(2)}`;
  if (n.startsWith('+')) {
    const cifre = n.slice(1);
    return cifre.length >= 8 && cifre.length <= 15 ? cifre : null;
  }

  // senza prefisso: si assume l'Italia solo se la lunghezza torna
  if (n.length === 10 && n.startsWith('3')) return `39${n}`;
  if (n.length === 9 && n.startsWith('3')) return `39${n}`;
  // gia con 39 davanti ma senza il piu
  if (n.startsWith('39') && n.length >= 11 && n.length <= 13) return n;
  return null;
}

/** Toglie chiocciola, indirizzo del sito e spazi da un nome utente. */
export function nomeUtente(grezzo: string, dominio: string): string | null {
  const pulito = String(grezzo ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(new RegExp(`^(www\\.)?${dominio}/`, 'i'), '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
    .trim();
  return /^[A-Za-z0-9._]{3,32}$/.test(pulito) ? pulito : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * Il collegamento da aprire, o null se quello che e stato scritto non sta in
 * piedi. Meglio nessun pulsante che un pulsante che porta altrove.
 */
export function collegamento(canale: Canale, riferimento: string): string | null {
  const r = String(riferimento ?? '').trim();
  if (!r) return null;

  switch (canale) {
    case 'whatsapp': {
      const n = numeroWhatsapp(r);
      return n ? `https://wa.me/${n}` : null;
    }
    case 'telegram': {
      const u = nomeUtente(r, 't\\.me');
      return u ? `https://t.me/${u}` : null;
    }
    case 'instagram': {
      const u = nomeUtente(r, 'instagram\\.com');
      return u ? `https://instagram.com/${u}` : null;
    }
    case 'email':
      return EMAIL.test(r) ? `mailto:${r}` : null;
    default:
      return null;
  }
}

/** Come si mostra il contatto nell'elenco, senza aprire niente. */
export function etichetta(canale: Canale, riferimento: string): string {
  const r = String(riferimento ?? '').trim();
  if (canale === 'whatsapp') {
    const n = numeroWhatsapp(r);
    // si mostrano solo le ultime cifre: chi deve scrivere preme il pulsante,
    // non ha bisogno di leggere il numero intero, e uno che passa nemmeno
    return n ? `WhatsApp · ···${n.slice(-4)}` : 'WhatsApp';
  }
  if (canale === 'email') return `Email · ${r.replace(/^(.).*(@.*)$/, '$1···$2')}`;
  const u = nomeUtente(r, canale === 'telegram' ? 't\\.me' : 'instagram\\.com');
  return `${CANALI[canale].nome} · @${u ?? r}`;
}

/** Vero se quello che e stato scritto produce un collegamento valido. */
export function valido(canale: Canale, riferimento: string): boolean {
  return collegamento(canale, riferimento) !== null;
}
