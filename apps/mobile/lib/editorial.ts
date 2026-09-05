import type { NewsItem } from '@satanelli/core';

/**
 * Notizie scritte dalla redazione.
 *
 * I fatti arrivano dalla stampa locale che segue il Foggia (foggiagol.it,
 * foggiatoday.it) e sono stati verificati incrociandoli con i dati della
 * stagione. Il testo è riscritto da zero: i fatti non sono di nessuno, la loro
 * formulazione si. Chi ha dato la notizia per primo è citato in fondo al pezzo,
 * che è cortesia oltre che buona pratica.
 *
 * Nella versione dimostrativa sono cinque. La sezione non ripubblica piu i
 * comunicati del club.
 */
export const editorial: NewsItem[] = [
  {
    id: 'ed-2026-09-04-abbonati',
    slug: 'cinquemila-abbonamenti',
    kind: 'editorial',
    date: '2026-09-04',
    title: 'Cinquemila e trecento hanno già deciso come passeranno le domeniche',
    excerpt: 'La campagna abbonamenti si chiude a 5.329 tessere. In Serie C è un numero che pesa.',
    body: `La campagna abbonamenti si è fermata a 5.329 tessere. Detto così è una cifra come un'altra, quindi conviene metterla accanto a qualcosa.

In Serie C ci sono squadre che il sabato riempiono a fatica duemila posti. Qui la metà della gradinata è già impegnata prima che la palla cominci a rotolare, e sono persone che hanno pagato in blocco senza sapere come sarebbe andata l'estate.

Il dato dice due cose. La prima riguarda la società, che su quelle tessere ha una base di ricavo certa da cui partire. La seconda riguarda chi gioca: allo Zaccheria si entra con cinquemila persone che hanno già scelto di esserci comunque, e quello si sente dal campo.

Fonte: foggiagol.it`,
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
    excerpt: 'Il mercato si chiude con due attaccanti e un centrocampista. Cosa dice la scelta.',
    body: `Il mercato si è chiuso con tre arrivi: Ferdinando Del Sole e Mario Ravasio davanti, Federico Zuccon in mezzo.

Guardando i ruoli si capisce dove la società pensava di essere corta. Due giocatori offensivi in entrata non sono un dettaglio per una squadra che nelle prime giornate ha fatto più fatica a segnare che a difendere, e Zuccon aggiunge una scelta in una zona dove finora si giravano sempre gli stessi.

Poi c'e il resto, che nessun comunicato dice: quanto ci mettono a capirsi con chi c'era già. Le prime giornate dopo una chiusura di mercato somigliano sempre a una squadra che si presenta, e i giudizi affrettati di settembre invecchiano male.

Fonte: foggiagol.it`,
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
    excerpt: 'Vantaggio di Luciani, ripresa in cui il pareggio arriva quasi per inerzia.',
    body: `Uno a uno con la Salernitana, ed è un punto che allo Zaccheria è stato accolto con più delusione che sollievo.

Il vantaggio arriva subito con Luciani, e per un tratto la partita sembra prendere una direzione precisa. Poi succede la cosa che capita alle squadre che devono ancora fidarsi di sé stesse: il possesso resta li, le occasioni si sprecano una dopo l'altra, e quando gli avversari trovano il pari nessuno può dire di non averlo visto arrivare.

Resta un dato che vale la pena tenere da parte: la squadra crea. In questa categoria le squadre che creano e non segnano di solito raddrizzano il conto più avanti; quelle che non creano affatto no.

Fonte: foggiagol.it`,
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
    excerpt: 'Appuntamento fissato per venerdì 4 settembre alle ventuno.',
    body: `La prima squadra si presenta ai tifosi venerdì 4 settembre alle ventuno.

È il tipo di serata che si liquida in fretta come rito di inizio stagione, e in parte lo è. Ma vale la pena esserci, e non per i discorsi: e l'unica occasione dell'anno in cui vedi in fila i volti che poi seguirai per nove mesi senza mai averli davvero guardati in faccia.

Chi ci è stato altre volte sa anche l'altra cosa: da come una piazza accoglie la squadra a settembre si capisce parecchio di che stagione sarà, molto prima della classifica.

Fonte: foggiagol.it`,
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
    excerpt: 'Designazione arrivata due giorni fa per la gara di domenica sera.',
    body: `A dirigere Foggia-Audace Cerignola sarà Leonardo Mastrodomenico.

La designazione di un arbitro è una di quelle notizie che in settimana normale nessuno legge, e che prima di un derby invece leggono tutti. Funziona così in ogni piazza, e la ragione non è sospetto: è che quando la partita pesa si cerca qualcosa da sapere in anticipo, qualunque cosa sia.

L'unica previsione sensata e che domenica sera se ne parlerà, comunque vada. Delle partite tra vicini si parla sempre, e quasi mai solo del gioco.

Fonte: foggiagol.it`,
    url: null,
    image: null,
    source: 'editorial',
  },
];
