/**
 * Titoli leggibili, dai comunicati scritti tutti in maiuscolo.
 *
 * Il club pubblica i titoli in maiuscolo ("DALL'ATALANTA ARRIVA FEDERICO
 * ZUCCON"). Un blocco di maiuscole si legge lettera per lettera, perche le
 * parole perdono la forma, ed e la prima cosa che diventa faticosa quando la
 * vista cala.
 *
 * Tutto minuscolo non va: i titoli sono fatti di nomi, e "federico zuccon"
 * perderebbe la persona. Quindi ogni parola prende la maiuscola iniziale,
 * tranne articoli, preposizioni e congiunzioni. Nessun nome si perde.
 *
 * Un titolo gia scritto in modo normale non si tocca.
 */

const MINUSCOLE = new Set([
  'a', 'ad', 'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'da', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
  'di', 'del', 'dello', 'della', 'dei', 'degli', 'delle',
  'in', 'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
  'su', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
  'con', 'per', 'tra', 'fra', 'e', 'ed', 'o', 'od', 'ma',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'è', 'e’', "e'", 'che', 'vs',
]);

/** Vero se il testo e quasi tutto in maiuscolo: almeno otto lettere, e l'85% maiuscole. */
export function tuttoMaiuscolo(t: string): boolean {
  const lettere = t.match(/\p{L}/gu) ?? [];
  if (lettere.length < 8) return false;
  const maiuscole = lettere.filter((c) => c !== c.toLowerCase()).length;
  return maiuscole / lettere.length >= 0.85;
}

function parola(p: string, prima: boolean): string {
  const basso = p.toLowerCase();
  if (!prima && MINUSCOLE.has(basso)) return basso;
  // pezzo per pezzo attorno ai trattini: in "U23-FOGGIA" la sigla resta, il nome no
  return p.split('-').map((pezzo) => {
    if (/\d/.test(pezzo)) return pezzo;
    // dopo un apostrofo si riparte con la maiuscola: Dall'Atalanta
    return pezzo.toLowerCase().replace(/(^|[’'])(\p{L})/gu, (_m, prima: string, lettera: string) => prima + lettera.toUpperCase());
  }).join('-');
}

export function titoloLeggibile(titolo: string | null | undefined): string {
  const t = (titolo ?? '').trim();
  if (!tuttoMaiuscolo(t)) return t;
  let primo = true;
  return t.split(/(\s+)/).map((pezzo) => {
    if (/^\s+$/.test(pezzo) || !pezzo) return pezzo;
    const fuori = parola(pezzo, primo);
    // dopo i due punti si ricomincia come all'inizio di una frase
    primo = /[:.!?]$/.test(pezzo);
    return fuori;
  }).join('');
}
