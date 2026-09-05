/**
 * Testi legali.
 *
 * Scritti per essere accurati, non per rassicurare: un'informativa che promette
 * "non raccogliamo niente" mentre il database tiene quello che scrivi e' peggio
 * di nessuna informativa, perche' e' una dichiarazione falsa.
 *
 * NON SOSTITUISCONO IL PARERE DI UN PROFESSIONISTA. Sono una bozza solida da
 * far rivedere prima di aprire le iscrizioni: e' esattamente la voce da 300
 * euro della raccolta fondi.
 */

export type Blocco =
  | { tipo: 'titolo'; testo: string }
  | { tipo: 'paragrafo'; testo: string }
  | { tipo: 'elenco'; voci: string[] }
  | { tipo: 'nota'; testo: string };

export const AGGIORNATO_AL = '5 settembre 2026';
export const CONTATTO = 'addigitalexperts@aol.com';

export const privacy: Blocco[] = [
  { tipo: 'nota', testo: `Ultimo aggiornamento: ${AGGIORNATO_AL}. Questa è una bozza in attesa della revisione di un professionista, che arriverà prima dell'apertura delle iscrizioni.` },

  { tipo: 'paragrafo', testo: "Il Tifo della Daunia è un progetto indipendente di tifosi, senza scopo di lucro e non affiliato al Calcio Foggia 1920. Questa informativa spiega quali dati l'app tratta e perché." },

  { tipo: 'titolo', testo: 'Chi tratta i dati' },
  { tipo: 'paragrafo', testo: `Il titolare del trattamento è la persona fisica che gestisce il progetto. Per qualsiasi richiesta si scrive a ${CONTATTO}, e la risposta arriva entro trenta giorni.` },

  { tipo: 'titolo', testo: 'Cosa serve per usare l\'app senza account' },
  { tipo: 'paragrafo', testo: "Senza registrarti non viene raccolto nulla che ti riguardi. Partite, classifica, rosa e statistiche si leggono senza dire chi sei. Quello che scrivi o voti in modalità dimostrativa resta nella memoria del tuo dispositivo e non viene inviato da nessuna parte." },

  { tipo: 'titolo', testo: 'Cosa viene raccolto quando ti registri' },
  { tipo: 'elenco', voci: [
    "L'indirizzo email e la password, che serve solo a farti entrare e viene conservata cifrata, mai in chiaro.",
    'Il nome che scegli, che vedono gli altri utenti.',
    "Se le carichi tu: l'immagine del profilo, due righe di presentazione e il settore in cui vai di solito.",
    'Quello che scrivi nella Curva: discussioni e risposte, con la data.',
    'I tuoi voti nelle pagelle, i pronostici e le presenze dichiarate.',
    'Se attivi le notifiche: un identificativo del dispositivo, che non contiene il tuo numero né il tuo nome.',
    "Registri tecnici del server: indirizzo IP e orario delle richieste, tenuti per la sicurezza e cancellati dopo poche settimane.",
  ] },

  { tipo: 'titolo', testo: 'Cosa NON viene fatto' },
  { tipo: 'elenco', voci: [
    'I dati non vengono venduti né ceduti a nessuno.',
    "Non c'è profilazione pubblicitaria e non ci sono strumenti di tracciamento di terzi.",
    'Non vengono raccolti la posizione, la rubrica, le foto della galleria o altro dal dispositivo.',
    'Non vengono chiesti dati che rivelino opinioni politiche, religiose o di salute, e non vanno scritti nemmeno nei messaggi.',
  ] },

  { tipo: 'titolo', testo: 'Perché è lecito trattarli' },
  { tipo: 'elenco', voci: [
    "Per farti usare l'app servono account e contenuti: la base è l'esecuzione del contratto, l'articolo 6.1.b del regolamento europeo 2016/679.",
    'Per la sicurezza del servizio e la moderazione dei contenuti la base è il legittimo interesse, articolo 6.1.f.',
    'Per le notifiche la base è il tuo consenso, articolo 6.1.a, e lo puoi togliere quando vuoi dalle impostazioni.',
  ] },

  { tipo: 'titolo', testo: 'Chi altro li vede' },
  { tipo: 'paragrafo', testo: "I dati stanno su Supabase, in un centro dati in Irlanda, quindi dentro l'Unione Europea. Il sito è servito da una rete di distribuzione che vede solo le richieste alle pagine. Se attivi le notifiche, l'invio passa dal servizio di Expo. Sono tutti fornitori che trattano i dati per conto del titolare e con contratto, non destinatari a cui i dati vengono ceduti." },

  { tipo: 'titolo', testo: 'Quanto vengono conservati' },
  { tipo: 'elenco', voci: [
    "Finché tieni l'account. Quando lo cancelli, profilo, immagine, voti, pronostici e presenze vengono rimossi.",
    "Le discussioni e le risposte restano visibili senza il tuo nome, perché cancellarle spezzerebbe conversazioni altrui. Se vuoi che spariscano del tutto, basta chiederlo.",
    'I registri tecnici del server durano poche settimane.',
  ] },

  { tipo: 'titolo', testo: 'Cosa puoi chiedere' },
  { tipo: 'paragrafo', testo: 'Il regolamento europeo ti riconosce il diritto di sapere quali dati ci sono, di correggerli, di cancellarli, di limitarne il trattamento, di riceverli in un formato leggibile da una macchina e di opporti al trattamento fondato sul legittimo interesse. Le richieste si mandano al contatto qui sopra.' },
  { tipo: 'paragrafo', testo: "Se pensi che qualcosa non vada puoi rivolgerti al Garante per la protezione dei dati personali, garanteprivacy.it, o all'autorità del paese in cui vivi." },

  { tipo: 'titolo', testo: 'Età minima' },
  { tipo: 'paragrafo', testo: "Per registrarsi bisogna avere almeno quattordici anni, che è l'età fissata in Italia dal decreto legislativo 101 del 2018. Sotto quell'età serve il consenso di chi esercita la responsabilità genitoriale." },

  { tipo: 'titolo', testo: 'Pubblicità' },
  { tipo: 'paragrafo', testo: "Oggi non c'è nessuna pubblicità. Se un giorno servisse per mantenere il progetto in piedi, questa informativa verrà aggiornata prima, e sarà scritto chiaramente cosa cambia. Una pubblicità basata sul profilo richiede un consenso separato: senza quello resterebbe pubblicità non personalizzata." },

  { tipo: 'titolo', testo: 'Se cambia qualcosa' },
  { tipo: 'paragrafo', testo: "Le modifiche vengono pubblicate qui con la data. Quelle che toccano quali dati vengono raccolti o perché saranno segnalate dentro l'app, non nascoste in fondo a una pagina." },
];

export const condizioni: Blocco[] = [
  { tipo: 'nota', testo: `Ultimo aggiornamento: ${AGGIORNATO_AL}. Bozza in attesa della revisione di un professionista.` },

  { tipo: 'titolo', testo: "Cos'è" },
  { tipo: 'paragrafo', testo: "Il Tifo della Daunia è un'app indipendente per i tifosi del Calcio Foggia 1920. Non è l'app ufficiale, la società non c'entra, non la sostiene e non la approva. I marchi citati appartengono ai rispettivi titolari e compaiono solo per far capire di quale squadra si parla." },

  { tipo: 'titolo', testo: 'Il servizio è gratuito e senza garanzie' },
  { tipo: 'paragrafo', testo: "L'app è offerta così com'è, gratuitamente, da una persona che la porta avanti nel tempo libero. Può capitare che un dato sia sbagliato o in ritardo, che una funzione smetta di andare o che il servizio si fermi. Non affidarti a questi dati per decisioni che contano: i risultati ufficiali stanno sui canali della Lega e del club, i biglietti si comprano sul canale ufficiale." },

  { tipo: 'titolo', testo: 'Da dove arrivano i dati sportivi' },
  { tipo: 'paragrafo', testo: "Partite, classifica, rosa e statistiche arrivano da fonti pubbliche. I prezzi dei settori sono indicativi e possono non essere aggiornati. Il riempimento dello stadio nel modello mostra chi ha dichiarato di andarci dentro l'app, non i biglietti venduti." },

  { tipo: 'titolo', testo: 'Biglietti' },
  { tipo: 'paragrafo', testo: "L'app non vende biglietti e non ne rivende: porta con un collegamento al canale ufficiale, dove l'acquisto avviene alle condizioni di chi lo gestisce." },

  { tipo: 'titolo', testo: 'Il tuo account' },
  { tipo: 'elenco', voci: [
    'Serve un indirizzo email vero e almeno quattordici anni.',
    'La password è tua responsabilità: non condividerla.',
    'Un account per persona. Gli account creati per aggirare una sospensione vengono rimossi.',
  ] },

  { tipo: 'titolo', testo: 'Cosa scrivi' },
  { tipo: 'paragrafo', testo: 'Quello che scrivi resta tuo. Pubblicandolo dai il permesso di mostrarlo dentro l\'app agli altri utenti, e nient\'altro: non viene rivenduto né usato per altro.' },
  { tipo: 'paragrafo', testo: 'Non sono ammessi:' },
  { tipo: 'elenco', voci: [
    'Insulti, minacce e attacchi personali, verso chiunque, giocatori e arbitri compresi.',
    'Contenuti discriminatori per origine, religione, orientamento, disabilità o genere.',
    'Incitamento alla violenza, dentro o fuori dallo stadio.',
    "Dati personali di altri: numeri, indirizzi, foto altrui senza permesso.",
    'Pubblicità, catene, vendita di biglietti fra privati.',
    'Contenuti coperti da diritto d\'autore di altri, caricati senza averne il diritto.',
  ] },

  { tipo: 'titolo', testo: 'Segnalazioni e moderazione' },
  { tipo: 'paragrafo', testo: "Ogni contenuto si può segnalare dall'app. Le segnalazioni vengono lette e, se il contenuto viola queste regole, rimosso. Chi ha scritto viene informato e può rispondere. Nei casi gravi o ripetuti l'account viene sospeso." },
  { tipo: 'paragrafo', testo: "Questo meccanismo esiste perché il regolamento europeo 2022/2065 sui servizi digitali lo richiede a chi ospita contenuti scritti da altri, e perché senza un posto dove parlano centinaia di tifosi diventa invivibile." },

  { tipo: 'titolo', testo: 'Immagini caricate' },
  { tipo: 'paragrafo', testo: "Puoi caricare un'immagine del profilo se ne hai il diritto. Immagini di altre persone senza il loro permesso, contenuti offensivi o marchi altrui usati come profilo vengono rimossi." },

  { tipo: 'titolo', testo: 'Chiudere il rapporto' },
  { tipo: 'paragrafo', testo: "Puoi cancellare l'account quando vuoi dalla schermata del profilo. Il progetto può chiudere o cambiare in qualsiasi momento: in quel caso viene dato preavviso dentro l'app e un modo per portare via quello che hai scritto." },

  { tipo: 'titolo', testo: 'Legge e foro' },
  { tipo: 'paragrafo', testo: "Si applica la legge italiana. Per chi usa l'app come consumatore resta competente il giudice del luogo di residenza, come prevede il codice del consumo." },

  { tipo: 'titolo', testo: 'Contatti' },
  { tipo: 'paragrafo', testo: `Per qualsiasi cosa: ${CONTATTO}.` },
];
