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
import { PAROLACCE, PAROLACCE_NOSTRE } from './parolacce.ts';

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
  'zoccola', 'mignotta', 'strunzo', 'strunz', 'fetente', 'fetent',
  'curnut', 'pezzente', 'sfondato', 'ubriaco', 'porcaccio', 'porcaccia',
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

/*
 * La famiglia "ki te mu ort".
 *
 * Si scrive in venti modi -- kitemu, kitemmuort, kitestramuort, chitemurt --
 * e un elenco fisso li perde tutti tranne quelli che uno si e ricordato. La
 * forma pero e sempre la stessa: ki/chi + te + (stra) + m + u/o + rt.
 *
 * Due regole invece di una, e la differenza e dove si puo guardare.
 * ANCORATA vale su una parola sola e parte dall'inizio, altrimenti prenderebbe
 * dentro parole italiane vere: "recitemmo" contiene "citemmo" e non c'entra
 * niente. LIBERA gira su tutto il testo attaccato, per chi spezza la parola,
 * ma pretende "uort" per intero: cosi non tocca niente di innocente.
 */
const DIALETTO_ANCORATO = /^(k|c)h?ite(stra)?m+[uo]+r?t*/;
const DIALETTO_LIBERO = /(k|c)h?ite(stra)?m+uort/;

const ELENCO = new Set([...PAROLACCE, ...PAROLACCE_NOSTRE]);

/**
 * Cerca una parolaccia.
 *
 * Solo parole intere. Cercarle dentro le altre farebbe bloccare parole
 * innocenti che se le portano dentro per caso, e un filtro che punisce chi non
 * ha fatto niente si fa odiare in fretta.
 */
export function parolaccia(testo: string): string | null {
  const { parole, unito } = normalizza(testo);
  for (const p of parole) {
    if (ELENCO.has(p)) return p;
    if (DIALETTO_ANCORATO.test(p)) return p;
  }
  const spezzata = DIALETTO_LIBERO.exec(unito);
  return spezzata ? spezzata[0] : null;
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

/* ------------------------------------------------------------ oscuramento */

/**
 * COPRIRE INVECE DI RESPINGERE
 *
 * Prima il messaggio con una parolaccia non partiva. Sembra la scelta severa
 * ed e la piu debole: chi ha scritto non sa quale parola ha fatto scattare il
 * filtro, riprova, sbaglia di nuovo, e alla terza volta smette di scrivere.
 * In una chat che dura novanta minuti significa perdere la persona, non la
 * parolaccia.
 *
 * Adesso il messaggio parte sempre e la parola si copre: resta la prima
 * lettera, il resto diventa asterischi. Si capisce che c'e un limite, si vede
 * dove, e la frase intorno non si perde.
 *
 * L'oscuramento e definitivo: nel database finisce il testo gia coperto, non
 * l'originale con una bandierina. Non si conserva quello che non si vuole
 * pubblicare.
 */

/** Una parola coperta: resta la prima lettera, il resto diventa asterischi. */
export function oscura(parola: string): string {
  return parola.length <= 1 ? '*' : parola[0]! + '*'.repeat(parola.length - 1);
}

/*
 * Le parole si cercano sul testo ORIGINALE, non su quello normalizzato.
 *
 * La normalizzazione toglie accenti, cambia i numeri in lettere e comprime le
 * ripetizioni: le posizioni non tornano piu, e non si saprebbe piu quale pezzo
 * del testo vero coprire. Quindi si tagliano prima le parole dov'erano, e ogni
 * parola si normalizza per conto suo.
 */
const PAROLA = /[\p{L}\p{N}@$]+/gu;

type Pezzo = { da: number; a: number; parola: string; norm: string };

function pezzi(testo: string): Pezzo[] {
  const fuori: Pezzo[] = [];
  PAROLA.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PAROLA.exec(testo)) !== null) {
    fuori.push({ da: m.index, a: m.index + m[0].length, parola: m[0], norm: normalizza(m[0]).unito });
  }
  return fuori;
}

function ricomponi(testo: string, elenco: Pezzo[], coperti: Set<number>): string {
  let fuori = '';
  let cursore = 0;
  elenco.forEach((p, i) => {
    if (!coperti.has(i)) return;
    fuori += testo.slice(cursore, p.da) + oscura(p.parola);
    cursore = p.a;
  });
  return fuori + testo.slice(cursore);
}

/**
 * Copre quello che non deve comparire e restituisce il resto intatto.
 *
 * Tre passaggi, dal piu preciso al piu grosso:
 *  1. due parole di seguito che fanno una bestemmia -- si coprono tutte e due
 *  2. una parola sola: parolaccia, bestemmia attaccata, o famiglia dialettale
 *  3. se dopo i primi due la bestemmia c'e ancora, vuol dire che e stata
 *     scritta spezzata ("d i o p o r c o") e non esiste una parola da coprire:
 *     li si copre tutto. Capita di rado e chi ci arriva lo ha fatto apposta.
 */
export function maschera(testo: string): { testo: string; cambiato: boolean } {
  const originale = String(testo ?? '');
  const elenco = pezzi(originale);
  if (elenco.length === 0) return { testo: originale, cambiato: false };

  const coperti = new Set<number>();

  for (let i = 0; i < elenco.length - 1; i++) {
    const a = elenco[i]!.norm;
    const b = elenco[i + 1]!.norm;
    if ((NOMI.includes(a) && QUALIFICHE.includes(b)) || (QUALIFICHE.includes(a) && NOMI.includes(b))) {
      coperti.add(i);
      coperti.add(i + 1);
    }
  }

  elenco.forEach((p, i) => {
    if (!p.norm) return;
    if (ELENCO.has(p.norm) || DIALETTO_ANCORATO.test(p.norm)) { coperti.add(i); return; }
    for (const n of NOMI) {
      if (!p.norm.includes(n)) continue;
      for (const q of QUALIFICHE) {
        if (attaccate(p.norm, n, q)) { coperti.add(i); return; }
      }
    }
  });

  let fuori = ricomponi(originale, elenco, coperti);
  if (!controlla(fuori).pulito) {
    elenco.forEach((_, i) => coperti.add(i));
    fuori = ricomponi(originale, elenco, coperti);
  }

  return { testo: fuori, cambiato: coperti.size > 0 };
}

/** Quello che si dice a chi ha scritto quando qualcosa e stato coperto. */
export const AVVISO_COPERTO = 'Qualche parola l’abbiamo coperta. Il resto è partito.';
