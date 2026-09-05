const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** "sab 6 set" */
export function shortDate(iso: string | null): string {
  if (!iso) return 'data da definire';
  const d = new Date(iso);
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

/** "sabato 6 settembre, 21:00" */
export function longDate(iso: string | null): string {
  if (!iso) return 'Data da definire';
  const d = new Date(iso);
  const giorno = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'][d.getDay()];
  return `${giorno} ${d.getDate()} ${MESI_LUNGHI[d.getMonth()]}, ${time(iso)}`;
}

export function time(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export type Countdown = { days: number; hours: number; minutes: number; seconds: number; past: boolean };

export function countdown(iso: string | null, now = Date.now()): Countdown {
  if (!iso) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  const diff = Date.parse(iso) - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    past: false,
  };
}

/** "3 h fa", "ieri", "2 set" */
export function relative(iso: string, now = Date.now()): string {
  const diff = now - Date.parse(iso);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ieri';
  if (d < 7) return `${d} giorni fa`;
  return shortDate(iso);
}

/** Iniziali per il segnaposto quando manca la foto o lo stemma. */
export function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, max)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Colore stabile derivato dal nome: due squadre diverse non hanno mai lo stesso segnaposto. */
export function hueFrom(seed: string): string {
  // Grigi neutri, non tinte casuali: in una palette rosso e nero un monogramma
  // verde o viola sembra un errore. La variazione serve solo a distinguere le
  // squadre fra loro, quindi basta muovere la luminosita.
  const n = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const l = 22 + (n % 5) * 5;
  return `hsl(220, 6%, ${l}%)`;
}

/**
 * Segnaposto dei ritratti: resta dentro i colori del club.
 * Una griglia di rosa con venti tinte diverse sembrava una tavolozza, non una squadra.
 */
export function avatarTone(seed: string): string {
  // Tutti nella famiglia del rosso, solo con saturazione e luminosita diverse.
  // Prima un seme su tre cadeva su un blu-grigio, e in mezzo agli altri sembrava
  // un errore invece di una variazione.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) % 997;
  const lightness = 17 + (h % 5) * 4;
  const sat = 20 + (h % 5) * 9;
  return `hsl(${354 + (h % 7)}, ${sat}%, ${lightness}%)`;
}

export function euro(n: number | null): string {
  if (n === null || n === undefined) return '-';
  return n % 1 === 0 ? `${n} €` : `${n.toFixed(2).replace('.', ',')} €`;
}

export function thousands(n: number): string {
  return n.toLocaleString('it-IT');
}
