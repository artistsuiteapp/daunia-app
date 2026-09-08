/**
 * Contratto dati condiviso fra l'ingest e l'app.
 * L'ingest produce JSON conformi a questi tipi; l'app li consuma senza sapere
 * da quale fonte arrivino. Cambiare fonte significa riscrivere solo services/ingest/src/sources.
 */

export type Iso = string;

export type SourceId = 'sportspress' | 'wikipedia' | 'editorial' | 'manual';

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed';

/** P portiere, D difensore, C centrocampista, A attaccante */
export type Role = 'P' | 'D' | 'C' | 'A';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  crest: string | null;
  isFoggia: boolean;
}

export interface Card {
  minute: number;
  player: string | null;
  side: 'home' | 'away';
  rosso: boolean;
}

export interface Sub {
  minute: number;
  esce: string | null;
  entra: string | null;
  side: 'home' | 'away';
}

export interface MatchTeam {
  id: string;
  name: string;
  shortName: string;
  crest: string | null;
}

export interface Goal {
  minute: number | null;
  /** minuti di recupero, es. 45+2 -> minute 45, extra 2 */
  extra: number | null;
  scorer: string;
  side: 'home' | 'away';
  ownGoal: boolean;
  penalty: boolean;
}

export interface Match {
  id: string;
  kickoff: Iso | null;
  status: MatchStatus;
  matchday: number | null;
  competition: string;
  season: string;
  home: MatchTeam;
  away: MatchTeam;
  score: { home: number; away: number } | null;
  venue: string | null;
  city: string | null;
  attendance: number | null;
  referee: string | null;
  goals: Goal[];
  /**
   * Cartellini e sostituzioni, quando la fonte degli eventi li ha.
   *
   * Wikipedia da solo i gol; live-score-api da anche questi, e le
   * sostituzioni con i due nomi -- chi esce e chi entra. Senza, la cronaca di
   * una partita sono due righe in novanta minuti.
   */
  cards?: Card[];
  subs?: Sub[];
  /** true se il Foggia gioca in casa */
  foggiaHome: boolean;
  /** 'W' | 'D' | 'L' dal punto di vista del Foggia, null se non giocata */
  foggiaResult: 'W' | 'D' | 'L' | null;
  ticketUrl: string | null;
  reportUrl: string | null;
  source: SourceId;
}

export interface Player {
  id: string;
  name: string;
  /** cognome o nome breve per le griglie */
  shortName: string;
  number: number | null;
  role: Role | null;
  roleLabel: string | null;
  /** ISO 3166-1 alpha-3, es. ITA, SEN */
  nationality: string | null;
  photo: string | null;
  onLoan: boolean;
  source: SourceId;
}

export interface StaffMember {
  id: string;
  name: string;
  job: string;
  photo: string | null;
}

export interface StandingRow {
  position: number;
  teamId: string;
  teamName: string;
  crest: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** Differenza fra punti in classifica e punti guadagnati sul campo: 0 o negativo. */
  penalty: number;
  isFoggia: boolean;
  /** zona: promozione, playoff, playout, retrocessione, null */
  zone: 'promotion' | 'playoff' | 'playout' | 'relegation' | null;
}

export interface NewsItem {
  id: string;
  date: Iso;
  title: string;
  excerpt: string;
  /** null per un pezzo nostro: non rimanda da nessuna parte */
  url: string | null;
  image: string | null;
  /** 'club' = comunicato ufficiale, 'editorial' = post nostro */
  kind: 'club' | 'editorial';
  slug: string;
  body?: string;
  source: SourceId;
}

/**
 * Una testata che ha dato il permesso di comparire in app.
 *
 * `logoSuChiaro` dice che il logo ha inchiostro scuro e va posato su una piastra
 * chiara: su fondo nero sparirebbe. Non e un dettaglio grafico, e il marchio di
 * qualcun altro e va reso leggibile come l'hanno disegnato.
 */
export interface Testata {
  id: string;
  nome: string;
  motto?: string;
  sito: string;
  logo: string | null;
  logoSuChiaro: boolean;
}

/**
 * Un articolo della rassegna stampa.
 *
 * Non c'e il corpo, e non e una dimenticanza: si mostrano titolo e sommario, e
 * chi vuole leggere esce dall'app e va sul sito della testata.
 */
export interface ArticoloStampa {
  id: string;
  testata: string;
  titolo: string;
  sommario: string;
  url: string;
  data: Iso;
  autore: string | null;
  categoria: string | null;
  /** L'og:image della loro pagina, collegata non copiata. null se non ce l'ha. */
  immagine: string | null;
}

/** Settore dello stadio, usato dal modello 3D e dalla scheda biglietti. */
export interface StadiumSector {
  id: string;
  name: string;
  /** lato della vasca su cui sta il settore */
  side: 'west' | 'east' | 'north' | 'south';
  capacity: number;
  covered: boolean;
  priceFrom: number | null;
  /** estremo alto quando il settore raccoglie piu fasce di prezzo */
  priceTo?: number | null;
  /** prezzo ridotto, dove il club lo pubblica */
  reduced?: number | null;
  /** true quando i biglietti non sono in vendita, per esempio perche presi dagli abbonamenti */
  soldOut?: boolean;
  /** una riga di spiegazione mostrata sotto il settore */
  note?: string | null;
  currency: 'EUR';
  /** La capienza per settore non e pubblicata dal club: e una stima. */
  capacityIsEstimated: boolean;
  /** I prezzi cambiano a ogni partita: quello mostrato e indicativo. */
  priceIsIndicative: boolean;
  /** 0..1, quota di riempimento. Simulato finché il club non dà i dati Vivaticket. */
  occupancy: number | null;
  occupancyIsSimulated: boolean;
  ticketUrl: string | null;
  /** posizione e forma per la geometria parametrica three.js */
  geometry: {
    /** lunghezza lungo il lato, in metri */
    length: number;
    /** profondità della gradinata, in metri */
    depth: number;
    /** numero di file */
    rows: number;
    /** altezza della prima fila da terra */
    baseHeight: number;
    /** altezza dell'ultima fila */
    topHeight: number;
    /** offset dal centro campo lungo l'asse perpendicolare */
    offset: number;
    /** scostamento lungo lo sviluppo della tribuna, per i settori che ne condividono un lato */
    shift?: number;
  };
}

export interface Stadium {
  name: string;
  city: string;
  capacity: number;
  capacityIsEstimated: boolean;
  pitch: { length: number; width: number };
  ticketUrl: string;
  priceNote: string;
  sectors: StadiumSector[];
}

/* ------------------------------------------------------------------ negozio */

export interface Product {
  id: string;
  name: string;
  /** prezzo in euro, gia convertito dai centesimi dell'API */
  price: number;
  regularPrice: number;
  onSale: boolean;
  currency: 'EUR';
  image: string | null;
  images: string[];
  category: string | null;
  categorySlug: string | null;
  url: string;
  inStock: boolean;
  description: string;
  source: SourceId;
}

export interface ShopCategory {
  slug: string;
  name: string;
  count: number;
}

/* ---------------------------------------------------------------- biglietti */

/**
 * Un settore dello stadio, e dove si comprano i biglietti per entrarci.
 *
 * Prezzo, ridotto e posti disponibili sono usciti da qui apposta: erano stime
 * -- occupazione simulata, ridotto al sessanta per cento del pieno -- che in
 * app comparivano come fatti. Un tifoso che legge "984 disponibili" e ci
 * organizza sopra una domenica e stato ingannato da noi, non dalla fonte.
 *
 * Tornano quando il club apre i dati di biglietteria, non prima.
 */
export interface TicketOffer {
  id: string;
  sectorId: string;
  sectorName: string;
  currency: 'EUR';
  covered: boolean;
  /** capienza del settore: indicativa, e il flag lo dice */
  capacity: number;
  capacityIsEstimated?: boolean;
  ticketUrl: string;
}

/* -------------------------------------------------------------- statistiche */

export interface SplitRecord {
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface CompetitionStats {
  competition: string;
  points: number | null;
  home: SplitRecord;
  away: SplitRecord;
}

/** Una giornata nell'andamento stagionale: dove si e giocato, come e finita, dove si era in classifica. */
export interface TrendPoint {
  matchday: number;
  venue: 'home' | 'away' | null;
  result: 'W' | 'D' | 'L' | null;
  position: number | null;
}

export interface GoalWindow {
  label: string;
  scored: number;
  conceded: number;
}

export interface TeamStats {
  competitions: CompetitionStats[];
  trend: TrendPoint[];
  /** ricavate dalle partite gia in archivio, non da una fonte esterna */
  derived: {
    played: number;
    cleanSheets: number;
    failedToScore: number;
    goalsFor: number;
    goalsAgainst: number;
    avgGoalsFor: number;
    avgGoalsAgainst: number;
    biggestWin: string | null;
    worstLoss: string | null;
    bestPosition: number | null;
    worstPosition: number | null;
    byWindow: GoalWindow[];
    scorers: Array<{ name: string; goals: number }>;
    homeAttendanceAvg: number | null;
  };
}

export interface Bundle {
  generatedAt: Iso;
  season: string;
  competition: string;
  /** da quale fonte arriva ogni blocco di dati */
  sources: Record<string, string>;
  /** attribuzione da mostrare in app: Wikipedia e CC BY-SA e va citata */
  attribution: string;
  /** avvisi generati dall'ingest, mostrati in app in debug e utili al pitch */
  warnings: string[];
}

export interface DataBundle {
  meta: Bundle;
  teams: Team[];
  matches: Match[];
  standings: StandingRow[];
  squad: Player[];
  staff: StaffMember[];
  news: NewsItem[];
  stadium: Stadium;
  shop: { products: Product[]; categories: ShopCategory[] };
  tickets: TicketOffer[];
  stats: TeamStats;
}

export const FOGGIA_TEAM_ID = 'foggia';
export const TICKET_URL = 'https://calciofoggia1920.vivaticket.it/';
