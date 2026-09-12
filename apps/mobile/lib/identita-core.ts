import { livelloDi } from './match-center-core.ts';

/**
 * Di che colore si scrive un nome, e che spilletta gli va accanto.
 *
 * LA REGOLA
 *
 * Il ruolo vince sempre sul livello. Un admin con zero punti resta rosso:
 * il colore serve a dire "questa persona risponde di quello che succede qui",
 * non a dire quanto ha giocato. Per tutti gli altri il colore e quello del
 * livello, che e la cosa che si guadagna.
 *
 * Sta in un file senza React e senza rete perche e una decisione, non un
 * disegno: si prova con un test invece che aprendo l'app e guardando.
 */

export type RuoloNome = 'anonimo' | 'utente' | 'moderatore' | 'admin';

export type TintaNome = {
  colore: string;
  /** nome dell'icona Ionicons, o null quando non va nessuna spilletta */
  spilletta: 'shield' | 'shield-half' | null;
  /** cosa dire a chi legge con la voce, e cosa scrivere nella scheda */
  etichetta: string | null;
};

const ADMIN = '#FF3B3B';
const MODERATORE = '#0A84FF';

export function tintaNome(ruolo: RuoloNome | null | undefined, punti: number | null | undefined): TintaNome {
  if (ruolo === 'admin') return { colore: ADMIN, spilletta: 'shield', etichetta: 'Admin' };
  if (ruolo === 'moderatore') return { colore: MODERATORE, spilletta: 'shield-half', etichetta: 'Moderatore' };

  // senza punti noti non si inventa un livello: resta il bianco del testo
  if (punti == null) return { colore: '#FFFFFF', spilletta: null, etichetta: null };

  const l = livelloDi(punti);
  return { colore: l.colore, spilletta: null, etichetta: l.nome };
}
