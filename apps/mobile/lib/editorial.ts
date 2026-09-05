import type { NewsItem } from '@satanelli/core';
import type { Cover } from '../components/ArticleCover';

/**
 * Notizie scritte dalla redazione.
 *
 * I fatti arrivano dalla stampa che segue il Foggia e sono stati controllati
 * incrociandoli con i dati di stagione dell'app. Il testo e scritto da zero: un
 * fatto non appartiene a nessuno, la sua formulazione si, quindi qui non c'e
 * nemmeno una frase ripresa. Nessun comunicato del club entra in questa sezione.
 *
 * Le copertine sono grafiche nostre, non fotografie: le immagini delle partite
 * sono di chi le ha scattate.
 */

export const COVERS: Record<string, Cover> = {
  'cinquemila-abbonamenti': { big: '5.329', label: 'abbonamenti sottoscritti' },
  'tre-innesti-in-chiusura': { big: '3', label: 'arrivi negli ultimi giorni', tone: 'dark' },
  'uno-a-uno-con-la-salernitana': { big: '1–1', label: 'seconda giornata · Zaccheria' },
  'la-squadra-si-presenta': { big: '21:00', label: 'venerdì 4 settembre', tone: 'dark' },
  'arbitro-del-derby': { big: '40 km', label: 'Foggia · Cerignola' },
};

export const editorial: NewsItem[] = [
  {
    id: 'ed-2026-09-04-abbonati',
    slug: 'cinquemila-abbonamenti',
    kind: 'editorial',
    date: '2026-09-04',
    title: 'Cinquemila e trecento hanno già deciso come passeranno le domeniche',
    excerpt: 'Le tessere sottoscritte sono 5.329. Per capire quanto pesa, va messa accanto a qualcos\'altro.',
    body: `Le tessere sottoscritte sono 5.329. Da sola una cifra non dice niente, quindi conviene metterla accanto a qualcos'altro.

In terza serie ci sono piazze che il sabato faticano a portare duemila persone sugli spalti. Qui metà della gradinata risulta impegnata prima ancora che la stagione entri nel vivo, e parliamo di gente che ha tirato fuori i soldi in blocco a luglio, senza sapere come sarebbe finita l'estate.

Due letture. Per chi amministra il club sono ricavi certi su cui costruire il bilancio, e in questa categoria non è cosa da poco. Per chi scende in campo è qualcosa di più concreto: allo Zaccheria si gioca davanti a cinquemila persone che hanno scelto in anticipo di esserci a prescindere, e la differenza dal prato si avverte.`,
    url: null,
    image: null,
    source: 'editorial',
  },
  {
    id: 'ed-2026-09-01-mercato',
    slug: 'tre-innesti-in-chiusura',
    kind: 'editorial',
    date: '2026-09-01',
    title: 'Tre nomi negli ultimi giorni: Del Sole, Ravasio e Zuccon',
    excerpt: 'Due davanti e uno in mezzo. I ruoli scelti dicono dove la dirigenza si sentiva scoperta.',
    body: `La finestra si è chiusa con tre firme: Ferdinando Del Sole e Mario Ravasio per il reparto offensivo, Federico Zuccon per la mediana.

I ruoli raccontano più dei nomi. Portare due giocatori offensivi negli ultimi giorni non è un caso in una squadra che finora ha avuto più difficoltà a finalizzare che a proteggere la propria area. Zuccon, dal canto suo, apre una possibilità di ricambio in una zona dove fino a ieri ruotavano sempre gli stessi piedi.

Poi resta la parte che nessun annuncio racconta: il tempo che serve a incastrarsi con chi c'era prima. Le settimane subito dopo una chiusura di mercato somigliano sempre a un gruppo che si presenta, e le sentenze scritte a settembre reggono di rado fino a Natale.`,
    url: null,
    image: null,
    source: 'editorial',
  },
  {
    id: 'ed-2026-08-29-salernitana',
    slug: 'uno-a-uno-con-la-salernitana',
    kind: 'editorial',
    date: '2026-08-29',
    title: 'Con la Salernitana finisce pari, ma il conto delle occasioni dice altro',
    excerpt: 'Avanti con Luciani, poi una ripresa in cui il pareggio arriva quasi per conto suo.',
    body: `Un punto contro la Salernitana, accolto dagli spalti con più fastidio che sollievo.

Il gol di Luciani arriva presto e per un tratto sembra indirizzare la serata. Poi si vede la cosa che capita ai gruppi che devono ancora prendere le proprie misure: il pallone resta dalla parte giusta, le palle buone si accumulano senza diventare niente, e quando dall'altra parte trovano il pari nessuno sugli spalti può dirsi sorpreso.

Un elemento vale la pena tenerlo da parte, però. Questa squadra le occasioni le costruisce. In terza serie chi arriva davanti alla porta e non segna di solito sistema i conti nel giro di qualche settimana; chi davanti alla porta non ci arriva affatto, quello è un problema diverso.`,
    url: null,
    image: null,
    source: 'editorial',
  },
  {
    id: 'ed-2026-09-03-presentazione',
    slug: 'la-squadra-si-presenta',
    kind: 'editorial',
    date: '2026-09-03',
    title: 'La squadra si presenta alla città, di venerdì sera',
    excerpt: 'Appuntamento alle ventuno di venerdì 4 settembre. Vale la pena esserci, e non per i discorsi.',
    body: `La prima squadra si mostra ai tifosi venerdì 4 settembre, alle ventuno.

Viene facile archiviarla come il solito rito di inizio stagione, e in parte lo è davvero. Ma andarci ha un senso, che non sta nei discorsi dal palco: è l'unica sera dell'anno in cui hai in fila davanti le facce che poi seguirai per nove mesi senza mai guardarle bene una per una.

C'e poi l'altra cosa, che sa chi ci è passato più volte. Dal modo in cui una piazza accoglie i suoi a settembre si intuisce parecchio del tipo di annata che verrà, con largo anticipo su qualsiasi classifica.`,
    url: null,
    image: null,
    source: 'editorial',
  },
  {
    id: 'ed-2026-09-02-arbitro',
    slug: 'arbitro-del-derby',
    kind: 'editorial',
    date: '2026-09-02',
    title: 'Il derby con il Cerignola lo dirige Mastrodomenico',
    excerpt: 'Designazione arrivata a inizio settimana per la sfida di domenica sera.',
    body: `Sarà Leonardo Mastrodomenico a dirigere Foggia-Audace Cerignola.

Il nome di un arbitro è la classica notizia che in una settimana qualunque non legge nessuno, e che prima di una partita fra vicini legge invece chiunque. Succede ovunque, e non è questione di sospetto: quando una gara pesa si cerca qualunque cosa da sapere in anticipo, e la designazione è l'unica cosa che c'e.

Quaranta chilometri separano le due città, e questo basta a spiegare il resto. L'unica previsione ragionevole è che domenica sera se ne discuterà comunque vada a finire, perché delle partite fra vicini si discute sempre, e quasi mai limitandosi a quello che è successo in campo.`,
    url: null,
    image: null,
    source: 'editorial',
  },
];

/** Copertina di un articolo, se ne ha una. */
export function coverOf(slug: string): Cover | null {
  return COVERS[slug] ?? null;
}
