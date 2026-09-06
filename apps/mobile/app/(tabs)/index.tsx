import { useEffect } from 'react';
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
import { PagelleInHome } from '../../components/PagelleInHome';
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
        <Greeting
          name={profilo?.nome ?? brand.demoUser.name}
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

      {pagelle ? (
        <Reveal delay={80}>
          <Pressable onPress={() => router.push(pagelle as never)} style={[gutter, styles.richiamo]}>
            <View style={styles.richiamoDentro}>
              <Ionicons name="star" size={18} color={colors.accentBright} />
              <View style={{ flex: 1 }}>
                <Text style={styles.richiamoTitolo}>Partita finita. Dai i voti.</Text>
                <Text style={styles.richiamoSotto}>
                  Le pagelle della Curva si scrivono adesso, a caldo.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </View>
          </Pressable>
        </Reveal>
      ) : oggi ? (
        <Reveal delay={80}>
          <Pressable
            onPress={() => router.push(chatViva ? '/live' : `/match/${oggi.id}` as never)}
            style={[gutter, styles.richiamo]}
          >
            <View style={styles.richiamoDentro}>
              {chatViva ? <PallinoLive compatto /> : (
                <Ionicons name="chatbubbles" size={18} color={colors.accentBright} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.richiamoTitolo}>
                  {chatViva ? 'La chat è aperta' : 'Oggi si gioca'}
                </Text>
                <Text style={styles.richiamoSotto}>
                  {chatViva
                    ? 'Entra e commenta con gli altri.'
                    : 'La chat dal vivo apre dieci minuti prima del fischio.'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </View>
          </Pressable>
        </Reveal>
      ) : null}

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
          {upcoming.slice(1, 3).map((m, i) => (
            <Reveal key={m.id} delay={180 + i * 60}><EventCard match={m} /></Reveal>
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
        ? <PagelleInHome match={(vivo?.finita && adessoFinito) || last!} />
        : null}

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

      <GroupLabel action={<Action label="Tutte" onPress={() => router.push('/news')} />}>
        Ultime dal club
      </GroupLabel>
      {lead ? (
        <View style={gutter}>
          <Pressable
            onPress={() => router.push(`/post/${lead.slug}` as never)}
            style={({ pressed }) => [styles.lead, pressed && { opacity: 0.85 }]}
          >
            {coverOf(lead.slug) ? <ArticleCover cover={coverOf(lead.slug)!} height={170} /> : null}
            <View style={styles.leadBody}>
              <Text style={styles.leadKicker}>{lead.kind === 'club' ? 'Ufficiale' : 'Redazione'}</Text>
              <Text style={styles.leadTitle} numberOfLines={3}>{lead.title}</Text>
              <Text style={styles.leadMeta}>{relative(lead.date)}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      <View style={[gutter, { marginTop: space.md }]}>
        <ListGroup>
          {rest.map((n) => (
            <ListRow key={n.id} onPress={() => router.push(`/post/${n.slug}` as never)} chevron height={64}>
              {coverOf(n.slug) ? (
                <View style={styles.thumb}><ArticleCover cover={coverOf(n.slug)!} height={40} compact /></View>
              ) : null}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.newsTitle} numberOfLines={2}>{n.title}</Text>
                <Text style={styles.newsMeta}>{relative(n.date)}</Text>
              </View>
            </ListRow>
          ))}
        </ListGroup>
      </View>

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
