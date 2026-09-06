/**
 * Filtro contro parolacce e bestemmie.
 *
 * PERCHE LE BESTEMMIE NON SONO UNA LISTA
 *
 * Ho cercato un elenco italiano gia pronto: non esiste. Esistono solo
 * generatori scherzosi, ed e proprio quello a dire come sono fatte. La
 * bestemmia italiana e combinatoria: un nome divino piu una qualifica
 * offensiva. Una lista fissa si aggira cambiando una lettera; una regola che
 * genera le combinazioni prende anche le storpiature che nessuno ha previsto.
 *
 * COME SI DIFENDE DALLE STORPIATURE
 *
 * Prima si normalizza: minuscole, accenti tolti, numeri riportati a lettere,
 * lettere ripetute compresse. Cosi `D1O P0OOORC0` e `dioporco` finiscono nella
 * stessa forma senza doverle elencare.
 *
 * IL PROBLEMA VERO SONO I FALSI POSITIVI
 *
 * Un filtro che blocca "diocesi" o "il cane di Dio" fa piu danni di uno che
 * lascia passare qualcosa. Per questo la coppia deve essere ATTACCATA:
 * o due parole di seguito, o unite senza niente in mezzo. Basta una parolina
 * fra le due e non scatta piu. Si perde qualche bestemmia costruita in modo
 * strano, e si guadagna il non insultare chi scrive in italiano.
 *
 * Questo file non ha React ne rete: e sotto test, ed e la copia di riferimento
 * della stessa regola che vive nel database.
 */
import { PAROLACCE } from './parolacce.ts';

export type Motivo = 'bestemmia' | 'parolaccia';
export type Esito = { pulito: true } | { pulito: false; motivo: Motivo; trovato: string };

/** Nomi divini. Da soli non vogliono dire niente: serve la coppia. */
const NOMI = [
  'dio', 'ddio', 'iddio', 'dii',
  'madonna', 'madona', 'madonnina',
  'cristo', 'cristoddio', 'gesu', 'gesucristo',
  'sacramento', 'sacramentodio',
];

/** Qualifiche offensive. Anche queste, da sole, sono parole normali. */
const QUALIFICHE = [
  'porco', 'porca', 'porcu', 'porc',
  'cane', 'cana', 'can',
  'boia', 'ladro', 'ladra', 'maiale', 'maial',
  'bestia', 'bastardo', 'bastarda',
  'stronzo', 'stronza', 'merda', 'merdoso',
  'puttana', 'putana', 'troia',
  'schifoso', 'schifosa', 'zozzo', 'zozza',
  'lurido', 'lurida', 'sporco', 'sporca',
  'infame', 'cornuto', 'impestato', 'marcio', 'fottuto',
];

/*
 * Numeri e simboli usati al posto delle lettere.
 *
 * Il punto esclamativo e la barra verticale NON ci sono, anche se somigliano a
 * una i: nella scrittura vera sono punteggiatura molto piu spesso che
 * sostituzioni, e trattarli da lettera trasformava "D1O!!!" in "dioi". Il
 * numero 1 copre gia la i per chi vuole nascondersi.
 */
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's',
};

/**
 * Riduce il testo alla forma su cui si cerca.
 *
 * `parole` serve a cercare coppie attaccate; `unito` a prendere chi scrive
 * tutto insieme o spaziato lettera per lettera.
 */
export function normalizza(testo: string): { parole: string[]; unito: string } {
  const base = String(testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0-9@$]/g, (c) => LEET[c] ?? ' ')
    // tre lettere uguali di fila o piu valgono una: "poooorco" e "porco"
    .replace(/([a-z])\1{2,}/g, '$1')
    .replace(/[^a-z]+/g, ' ')
    .trim();

  const parole = base ? base.split(' ') : [];
  return { parole, unito: parole.join('') };
}

/** Vero se in `unito` i due pezzi compaiono attaccati, in un ordine o nell'altro. */
function attaccate(unito: string, a: string, b: string): boolean {
  return unito.includes(a + b) || unito.includes(b + a);
}

/**
 * Cerca una bestemmia.
 *
 * Due strade sole, tutte e due strette:
 *  - due parole di seguito: "dio porco", "porco dio", "madonna puttana"
 *  - tutto attaccato: "dioporco", "porcoddio", e anche "d i o p o r c o"
 *
 * "il cane di Dio" non scatta, e non deve.
 */
export function bestemmia(testo: string): string | null {
  const { parole, unito } = normalizza(testo);
  if (!unito) return null;

  for (let i = 0; i < parole.length - 1; i++) {
    const a = parole[i]!;
    const b = parole[i + 1]!;
    if ((NOMI.includes(a) && QUALIFICHE.includes(b)) || (QUALIFICHE.includes(a) && NOMI.includes(b))) {
      return `${a} ${b}`;
    }
  }

  for (const n of NOMI) {
    if (!unito.includes(n)) continue;
    for (const q of QUALIFICHE) {
      if (attaccate(unito, n, q)) return `${n}+${q}`;
    }
  }

  return null;
}

const ELENCO = new Set(PAROLACCE);

/**
 * Cerca una parolaccia.
 *
 * Solo parole intere. Cercarle dentro le altre farebbe bloccare parole
 * innocenti che se le portano dentro per caso, e un filtro che punisce chi non
 * ha fatto niente si fa odiare in fretta.
 */
export function parolaccia(testo: string): string | null {
  const { parole } = normalizza(testo);
  for (const p of parole) if (ELENCO.has(p)) return p;
  return null;
}

/** Il giudizio completo. */
export function controlla(testo: string): Esito {
  const b = bestemmia(testo);
  if (b) return { pulito: false, motivo: 'bestemmia', trovato: b };
  const p = parolaccia(testo);
  if (p) return { pulito: false, motivo: 'parolaccia', trovato: p };
  return { pulito: true };
}

/** Quello che si dice a chi ha scritto. Mai in silenzio: si riscrive peggio. */
export function spiegazione(e: Esito): string | null {
  if (e.pulito) return null;
  return e.motivo === 'bestemmia'
    ? 'Qui le bestemmie non passano. Riscrivi senza e il messaggio parte.'
    : 'C\'è una parola che qui non passa. Riscrivi e il messaggio parte.';
}
