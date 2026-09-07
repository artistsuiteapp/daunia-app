import { useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  Screen, GroupLabel, ListGroup, ListRow, GroupNote, useGutter, BigStat, Card,
} from '../../components/ui';
import { BrandHeader } from '../../components/BrandHeader';
import { Greeting } from '../../components/Greeting';
import { Reveal } from '../../components/Reveal';
import { QuickNav } from '../../components/QuickNav';
import { EventCard } from '../../components/EventCard';
import { Crest } from '../../components/Crest';
import { brand } from '../../theme/brand';
import { colors, radius, space, type } from '../../theme/tokens';
import { relative } from '../../lib/format';
import { coverOf } from '../../lib/editorial';
import { ArticleCover } from '../../components/ArticleCover';
import { photo } from '../../lib/media';
import { useSafeInsets } from '../../lib/viewport';
import { useBenvenuto } from '../../lib/ospite';
import { useProfilo } from '../../lib/auth';
import { useLive } from '../../lib/live';
import { eOggi } from '../../lib/live-core';
import { salaAperta } from '../../lib/sala';
import { PallinoLive } from '../../components/PallinoLive';
import { BanneriAzione, type Azione } from '../../components/BanneriAzione';
import { PagelleInHome } from '../../components/PagelleInHome';
import { MvpDelMese } from '../../components/MvpDelMese';
import { caricaMigliore, migliorePartita, caricaMvpMese, mvpDelMese, useFanplay } from '../../lib/fanplay';
import { statoMigliore, statoMese } from '../../lib/premi-core';
import { fineVera } from '../../lib/live';
import { squad } from '../../lib/data';
import {
  FOGGIA, foggiaRow, lastMatch, matchInCorso, meta, news, nextMatch, recentForm,
  standingsWindow, topScorers, upcomingMatches,
} from '../../lib/data';

export default function Home() {
  const gutter = useGutter();
  const insets = useSafeInsets();
  // Alla prima apertura si sceglie: account o solo guardare. La scelta si
  // ricorda, cosi chi ha detto "guardo e basta" non se lo sente richiedere.
  const benvenuto = useBenvenuto();
  // il nome e la foto veri di chi sta usando l'app; i dati di esempio restano
  // solo per chi guarda senza account
  const profilo = useProfilo();

  useEffect(() => {
    if (benvenuto.mostra) router.replace('/benvenuto' as never);
  }, [benvenuto.mostra]);
  const next = nextMatch();
  // la partita di oggi anche dopo il triplice: serve a puntare alle pagelle
  const adessoFinito = matchInCorso();
  // se si sta giocando adesso, la scheda in cima e quella, non la prossima.
  // Il calendario da solo non basta: dice che siamo dentro le tre ore della
  // partita, non che si sta ancora giocando. Al triplice fischio la fonte dal
  // vivo lo sa, e l'etichetta deve smettere di dire "si gioca adesso".
  const vivo = useLive();
  const adesso = vivo?.finita ? null : matchInCorso();
  // il giorno della partita si dice che ci sara la chat, cosi chi apre l'app la
  // mattina sa di doverci tornare la sera
  const oggi = next && eOggi(next.kickoff) ? next : null;
  const chatViva = oggi ? salaAperta(oggi.kickoff) : false;
  // a fine partita i voti si danno a caldo o non si danno piu
  const pagelle = vivo?.finita && adessoFinito ? `/match/${adessoFinito.id}?tab=gioco` : null;

  // i premi finiscono anche nelle slide, non solo nei loro riquadri: sono la
  // cosa per cui uno riapre l'app, e in fondo alla home non li vedrebbe
  useFanplay();
  const mese = statoMese();
  const vivoPremio = statoMigliore(fineVera() ?? adessoFinito?.kickoff, next?.kickoff);
  useEffect(() => { if (adessoFinito) void caricaMigliore(adessoFinito.id); }, [adessoFinito]);
  const miglioreOra = adessoFinito ? migliorePartita(adessoFinito.id) : null;
  const mvpOra = mvpDelMese()[0] ?? null;

  /*
   * I richiami, in ordine di urgenza.
   *
   * Scorrono in un carosello invece di impilarsi: prima erano riquadri uno
   * sotto l'altro, e ogni funzione nuova ne aggiungeva uno finche la home
   * diventava un elenco di avvisi.
   *
   * Portano tutti a fare qualcosa -- votare, scrivere, dire se ci sei -- non a
   * leggere. Le cose da leggere stanno nella scheda News.
   *
   * L'ordine non e casuale: prima quello che scade (la chat vive un'ora, le
   * pagelle un giorno), poi quello che resta li.
   */
  const azioni = useMemo<Azione[]>(() => {
    const a: Azione[] = [];

    /*
     * I premi in cima, quando sono vivi.
     *
     * Il migliore in campo dura un giorno e poi sparisce, quindi quando c'e
     * viene prima di tutto il resto: e la cosa che scade.
     */
    if (adessoFinito && vivoPremio.fase !== 'niente' && miglioreOra) {
      const p = squad.find((g) => g.id === miglioreOra.giocatore);
      a.push({
        chiave: 'mvp',
        occhiello: vivoPremio.fase === 'votazione' ? 'si vota adesso' : 'migliore in campo',
        titolo: p?.shortName ?? p?.name ?? miglioreOra.giocatore,
        sotto: vivoPremio.fase === 'votazione'
          ? `In testa con ${miglioreOra.quanti} voti. Puoi ancora cambiare le carte.`
          : `Il migliore dell'ultima partita, scelto dalla Curva.`,
        cifra: miglioreOra.media.toFixed(1),
        icona: 'trophy',
        rotta: `/match/${adessoFinito.id}?tab=gioco`,
      });
    }

    if (mvpOra) {
      const p = squad.find((g) => g.id === mvpOra.giocatore);
      a.push({
        chiave: 'mvp-mese',
        occhiello: mese.chiuso ? 'migliore del mese' : 'classifica del mese',
        titolo: p?.shortName ?? p?.name ?? mvpOra.giocatore,
        sotto: mese.chiuso
          ? `Il migliore del mese, con ${mvpOra.quanti} voti in ${mvpOra.partite} partite.`
          : `In testa questo mese. Ogni voto lo può spostare.`,
        cifra: mvpOra.media.toFixed(1),
        icona: 'star',
        rotta: adessoFinito ? `/match/${adessoFinito.id}?tab=gioco` : '/pronostici',
      });
    }

    if (chatViva && oggi) {
      a.push({
        chiave: 'chat', vivo: true,
        occhiello: 'in corso',
        titolo: 'La chat è aperta',
        sotto: 'Commenta la partita con gli altri, adesso.',
        icona: 'chatbubbles', rotta: '/live',
      });
    }
    if (pagelle) {
      a.push({
        chiave: 'pagelle',
        occhiello: 'pagelle',
        titolo: 'Dai i voti alla partita',
        sotto: 'Le pagelle della Curva si scrivono a caldo.',
        icona: 'star', rotta: pagelle,
      });
    }
    if (oggi && !chatViva) {
      a.push({
        chiave: 'oggi',
        occhiello: 'oggi',
        titolo: 'Oggi si gioca',
        sotto: 'La chat dal vivo apre dieci minuti prima del fischio.',
        icona: 'football', rotta: `/match/${oggi.id}`,
      });
    }
    if (next && !oggi) {
      a.push({
        chiave: 'pronostico',
        occhiello: 'pronostico',
        titolo: 'Fai il tuo pronostico',
        sotto: `${next.home.shortName}–${next.away.shortName}, prima del fischio.`,
        icona: 'trophy', rotta: `/match/${next.id}?tab=gioco`,
      });
    }
    if (next && !next.foggiaHome) {
      a.push({
        chiave: 'trasferta',
        occhiello: 'trasferta',
        titolo: 'Vai in trasferta?',
        sotto: 'Dillo agli altri e organizzatevi il viaggio.',
        icona: 'car', rotta: '/trasferte',
      });
    }
    if (next?.foggiaHome) {
      a.push({
        chiave: 'stadio',
        occhiello: 'allo stadio',
        titolo: 'Ci sei allo Zaccheria?',
        sotto: 'Scegli il settore e vedi chi altro ci va.',
        icona: 'location', rotta: '/stadium',
      });
    }
    a.push({
      chiave: 'curva',
      occhiello: 'la curva',
      titolo: 'Scrivi nella Curva',
      sotto: 'Il posto dove si discute fra una partita e l’altra.',
      icona: 'megaphone', rotta: '/curva',
    });
    return a;
  }, [chatViva, oggi, pagelle, next, adessoFinito, vivoPremio, miglioreOra, mvpOra, mese]);
  const last = lastMatch();
  const row = foggiaRow();
  const scorer = topScorers()[0];
  const upcoming = upcomingMatches().slice(0, 8);

  const feed = news.slice(0, 6);
  const leadIndex = Math.max(0, feed.findIndex((n) => n.image));
  const lead = feed[leadIndex];
  const rest = feed.filter((_, i) => i !== leadIndex).slice(0, 4);

  return (
    <Screen edgeToEdge>
      {/* aggiunta alla schermata Home l'app parte sotto la barra di stato:
          senza la zona sicura il saluto finisce sopra l'orologio */}
      <View style={[styles.greeting, gutter, { paddingTop: insets.top + space.md }]}>
        {/* senza account non si inventa un nome: prima diceva "Mario Rossi" a
            chiunque, e il saluto sembrava rivolto a qualcun altro */}
        <Greeting
          name={profilo?.nome ?? null}
          crest={null}
          avatar={profilo?.avatar ?? null}
          onBell={() => router.push('/notifiche')}
        />
      </View>

      <BrandHeader
        crest={FOGGIA?.crest ?? null}
        competition={meta.competition}
        season={meta.season}
        form={recentForm()}
        position={row?.position ?? null}
        points={row?.points ?? null}
      />

      <Reveal delay={60}><QuickNav pagelle={pagelle} /></Reveal>

      <Reveal delay={80}><BanneriAzione azioni={azioni} /></Reveal>

      {next ? (
        <>
          <GroupLabel action={<Action label="Calendario" onPress={() => router.push('/matches')} />}>
            {adesso?.id === next.id ? 'Si gioca adesso'
              // finita ma ancora in cima: per tre ore la scheda resta li col
              // risultato, e chiamarla "prossima" e falso
              : vivo?.finita && adessoFinito?.id === next.id ? 'Appena finita'
              : next.foggiaHome ? 'Prossima in casa' : 'Prossima trasferta'}
          </GroupLabel>
          <Reveal delay={120}><View style={gutter}><EventCard match={next} tone="accent" /></View></Reveal>
        </>
      ) : null}

      {/* le partite successive impilate sotto quella di riferimento, come nella
          reference: stessa scheda, ma scura, così si legge subito quale conta */}
      {upcoming.length > 1 ? (
        <View style={[gutter, styles.stack]}>
          {/* quella di riferimento resta grande, le successive compatte:
              servono a sapere che ci sono, non a essere guardate */}
          {upcoming.slice(1, 5).map((m, i) => (
            <Reveal key={m.id} delay={180 + i * 60}><EventCard match={m} compatta /></Reveal>
          ))}
        </View>
      ) : null}

      <GroupLabel action={<Action label="Tutte" onPress={() => router.push('/stats')} />}>
        La stagione
      </GroupLabel>
      <Reveal delay={220}>
      <View style={[styles.tiles, gutter]}>
        <Card style={styles.tile}>
          <BigStat label="Posizione" value={row ? `${row.position}°` : '-'} sub={row ? `${row.points} punti` : undefined} />
        </Card>
        <Card style={styles.tile}>
          <BigStat label="Reti" value={row ? `${row.goalsFor}:${row.goalsAgainst}` : '-'} sub={row ? diffLabel(row.goalDiff) : undefined} />
        </Card>
        <Card style={styles.tile}>
          <BigStat label="Bilancio" value={row ? `${row.won}-${row.drawn}-${row.lost}` : '-'} sub="V-N-P" />
        </Card>
        {scorer ? (
          <Card style={styles.tile}><BigStat label="Marcatore" value={scorer.goals} sub={scorer.name} /></Card>
        ) : null}
      </View>
      </Reveal>

      {/* le pagelle votate ieri sera, prima dell'ultimo risultato: chi apre
          l'app il giorno dopo vuole quelle, il punteggio lo sa gia */}
      {/* la partita di ieri sera, non quella prima: il calendario di Wikipedia
          la marca "finita" con ore di ritardo, e in quelle ore in home
          uscirebbero le pagelle della gara sbagliata */}
      {(vivo?.finita && adessoFinito) || last
        ? <PagelleInHome match={(vivo?.finita && adessoFinito) || last!} prossimoKickoff={next?.kickoff} />
        : null}

      {/* dopo le pagelle della singola gara: prima com'e andata ieri, poi come
          sta andando il mese */}
      <MvpDelMese />

      {last ? (
        <>
          <GroupLabel>Ultimo risultato</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              <ListRow onPress={() => router.push(`/match/${last.id}` as never)} chevron height={56}>
                <Crest uri={last.home.crest} name={last.home.shortName} size={26} />
                <Text style={styles.lastName} numberOfLines={1}>{last.home.shortName}</Text>
                <Text style={styles.lastScore}>{last.score?.home}–{last.score?.away}</Text>
                <Text style={[styles.lastName, styles.lastRight]} numberOfLines={1}>{last.away.shortName}</Text>
                <Crest uri={last.away.crest} name={last.away.shortName} size={26} />
              </ListRow>
            </ListGroup>
          </View>
        </>
      ) : null}

      <GroupLabel action={<Action label="Tutta" onPress={() => router.push('/standings')} />}>
        Classifica
      </GroupLabel>
      <View style={gutter}>
        <ListGroup>
          {standingsWindow(5).map((r) => (
            <ListRow key={r.teamId} height={44} right={<Text style={[styles.pts, r.isFoggia && styles.own]}>{r.points}</Text>}>
              <Text style={[styles.pos, r.isFoggia && styles.own]}>{r.position}</Text>
              <Crest uri={r.crest} name={r.teamName} size={22} />
              <Text style={[styles.standName, r.isFoggia && styles.ownName]} numberOfLines={1}>{r.teamName}</Text>
            </ListRow>
          ))}
        </ListGroup>
      </View>

      {/* Le notizie stanno nella loro scheda, non in home.
          In home ci vanno le cose da fare -- votare, scrivere, dire se ci
          sei -- non quelle da leggere: chi vuole leggere apre News. */}

      <GroupNote>{meta.attribution}</GroupNote>
    </Screen>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Text style={styles.action}>{label}</Text>
    </Pressable>
  );
}

function diffLabel(d: number) {
  return d > 0 ? `+${d} differenza` : `${d} differenza`;
}

const styles = StyleSheet.create({
  richiamo: { marginBottom: space.sm },
  richiamoDentro: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    padding: space.lg, borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)',
  },
  richiamoTitolo: { ...type.subheadBold, color: colors.text },
  richiamoSotto: { ...type.footnote, color: colors.textDim, marginTop: 2 },
  greeting: { paddingBottom: space.md, backgroundColor: colors.bg },
  action: { ...type.subhead, color: colors.accentBright },
  stack: { gap: space.sm, marginTop: space.sm },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, flexBasis: '46%', padding: space.md },

  lastName: { ...type.subhead, color: colors.text, flex: 1 },
  lastRight: { textAlign: 'right' },
  lastScore: { ...type.numberSm, color: colors.text },

  pos: { ...type.footnote, color: colors.textDim, width: 20 },
  standName: { ...type.subhead, color: colors.text, flex: 1 },
  ownName: { ...type.subheadBold, color: colors.text },
  pts: { ...type.headline, color: colors.text, width: 28, textAlign: 'right' },
  own: { color: colors.accentBright },

  lead: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  leadImg: { width: '100%', height: 180, backgroundColor: colors.surfaceHi },
  leadBody: { padding: space.lg, gap: 4 },
  leadKicker: { ...type.footnoteBold, color: colors.accentBright },
  leadTitle: { ...type.title3, color: colors.text },
  leadMeta: { ...type.footnote, color: colors.textFaint, marginTop: 2 },

  thumb: { width: 64, height: 40, overflow: 'hidden', borderRadius: radius.sm, backgroundColor: colors.surfaceHi },
  thumbEmpty: {},
  newsTitle: { ...type.subhead, color: colors.text },
  newsMeta: { ...type.caption, color: colors.textFaint },
});
