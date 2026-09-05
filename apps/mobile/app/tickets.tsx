import { Linking, StyleSheet, Text, View } from 'react-native';
import type { TicketOffer } from '@satanelli/core';

import {
  Screen, LargeTitle, ListGroup, ListRow, GroupLabel, GroupNote, Badge, Button, Card, BigStat, useGutter,
} from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Crest } from '../components/Crest';
import { brand } from '../theme/brand';
import { colors, radius, space, type } from '../theme/tokens';
import { euro, longDate, shortDate, thousands, time } from '../lib/format';
import { FOGGIA, nextHomeMatch, stadium, tickets } from '../lib/data';

export default function Tickets() {
  const gutter = useGutter();
  const match = nextHomeMatch();
  const cheapest = [...tickets].sort((a, b) => a.price - b.price)[0];
  const totalAvailable = tickets.reduce((a, t) => a + t.available, 0);

  return (
    <Screen>
      <BackBar />
      <LargeTitle crest={FOGGIA?.crest ?? null} title="Biglietti" subtitle={`Zaccheria · vendita su ${brand.ticketProvider.name}`} />

      {match ? (
        <View style={gutter}>
          <TicketStub
            homeName={match.home.shortName}
            awayName={match.away.shortName}
            homeCrest={match.home.crest}
            awayCrest={match.away.crest}
            kickoff={match.kickoff}
            matchday={match.matchday}
            competition={match.competition}
            sector={cheapest?.sectorName ?? 'Curva Nord'}
            price={cheapest?.price ?? 0}
          />
        </View>
      ) : null}

      <View style={[styles.summary, gutter]}>
        <Card style={styles.sumTile}>
          <BigStat label="Disponibili" value={thousands(totalAvailable)} sub={`su ${thousands(stadium.capacity)}`} />
        </Card>
        <Card style={styles.sumTile}>
          <BigStat label="Da" value={euro(cheapest?.price ?? null)} sub="prezzo minimo" />
        </Card>
      </View>

      <GroupLabel>Scegli il settore</GroupLabel>
      <View style={gutter}>
        <ListGroup>
          {tickets.map((t) => <SectorRow key={t.id} offer={t} />)}
        </ListGroup>
      </View>

      <View style={[gutter, { marginTop: space.xl }]}>
        <Button
          label={`Apri ${brand.ticketProvider.name}`}
          icon="open-outline"
          onPress={() => Linking.openURL(brand.ticketProvider.url)}
        />
      </View>

      <GroupNote>
        Il biglietto qui sopra è un esempio, non un titolo d'ingresso. La vendita resta su
        {' '}{brand.ticketProvider.name}. Prezzi e disponibilità sono stime finché il club non apre
        i dati di biglietteria.
      </GroupNote>
    </Screen>
  );
}

/**
 * Biglietto di esempio disegnato come un tagliando: due blocchi separati da una
 * linea di strappo, codice a barre in fondo. Serve a far vedere al club come
 * apparirebbe il titolo dentro l'app, non a valere come ingresso.
 */
function TicketStub({ homeName, awayName, homeCrest, awayCrest, kickoff, matchday, competition, sector, price }: {
  homeName: string; awayName: string; homeCrest: string | null; awayCrest: string | null;
  kickoff: string | null; matchday: number | null; competition: string; sector: string; price: number;
}) {
  return (
    <View style={styles.stub}>
      <View style={styles.stubTop}>
        <View style={styles.stubHead}>
          <Badge label={matchday ? `${matchday}ª giornata` : competition} tone="accent" />
          <Text style={styles.demo}>esempio</Text>
        </View>

        <View style={styles.stubTeams}>
          <View style={styles.stubTeam}>
            <Crest uri={homeCrest} name={homeName} size={42} />
            <Text style={styles.stubTeamName} numberOfLines={1}>{homeName}</Text>
          </View>
          <Text style={styles.stubVs}>—</Text>
          <View style={styles.stubTeam}>
            <Crest uri={awayCrest} name={awayName} size={42} />
            <Text style={styles.stubTeamName} numberOfLines={1}>{awayName}</Text>
          </View>
        </View>

        <Text style={styles.stubWhen}>{longDate(kickoff)}</Text>
      </View>

      <View style={styles.tearRow}>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={styles.tear} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      <View style={styles.stubBottom}>
        <View style={styles.stubFields}>
          {/* il nome del settore e più lungo degli altri campi: gli si da più spazio */}
          <Field label="Settore" value={sector} grow={2.2} />
          <Field label="Fila" value="12" />
          <Field label="Posto" value="47" />
          <Field label="Prezzo" value={euro(price)} accent grow={1.2} />
        </View>
        <Barcode />
        <Text style={styles.stubCode}>FG · {shortDate(kickoff)} · {time(kickoff)} · 0000 0000</Text>
      </View>
    </View>
  );
}

function Field({ label, value, accent = false, grow = 1 }: {
  label: string; value: string; accent?: boolean; grow?: number;
}) {
  return (
    <View style={[styles.field, { flex: grow }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, accent && { color: colors.accentBright }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

/** Codice a barre finto: barre di larghezza variabile, deterministiche. */
function Barcode() {
  const bars = Array.from({ length: 48 }, (_, i) => 1 + ((i * 7919) % 4));
  return (
    <View style={styles.barcode}>
      {bars.map((w, i) => (
        <View
          key={i}
          style={{ width: w, height: 42, backgroundColor: i % 3 === 0 ? 'transparent' : colors.text, opacity: i % 3 === 0 ? 0 : 0.92 }}
        />
      ))}
    </View>
  );
}

function SectorRow({ offer }: { offer: TicketOffer }) {
  const soldOut = offer.available <= 0;
  const fill = 1 - offer.available / offer.capacity;

  return (
    <ListRow
      onPress={() => Linking.openURL(offer.ticketUrl)}
      chevron
      height={70}
      right={
        <View style={styles.offerRight}>
          <Text style={styles.offerPrice}>{euro(offer.price)}</Text>
          {offer.reducedPrice != null ? (
            <Text style={styles.offerReduced}>ridotto {euro(offer.reducedPrice)}</Text>
          ) : null}
        </View>
      }
    >
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={styles.offerName}>{offer.sectorName}</Text>
        <Text style={styles.offerMeta}>
          {offer.covered ? 'coperto' : 'scoperto'} · {soldOut ? 'esaurito' : `${thousands(offer.available)} disponibili`}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(fill * 100)}%` }]} />
        </View>
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  stub: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden' },
  stubTop: { padding: space.lg, gap: space.lg },
  stubHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  demo: { ...type.caption, color: colors.textFaint },
  stubTeams: { flexDirection: 'row', alignItems: 'center' },
  stubTeam: { flex: 1, alignItems: 'center', gap: 6 },
  stubTeamName: { ...type.subheadBold, color: colors.text, textAlign: 'center' },
  stubVs: { ...type.title3, color: colors.textFaint, width: 40, textAlign: 'center' },
  stubWhen: { ...type.footnote, color: colors.textDim, textAlign: 'center' },

  tearRow: { flexDirection: 'row', alignItems: 'center', height: 20 },
  tear: { flex: 1, height: 1, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: colors.separator },
  notch: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.bg },
  notchLeft: { marginLeft: -10 },
  notchRight: { marginRight: -10 },

  stubBottom: { padding: space.lg, gap: space.lg },
  stubFields: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  field: { flex: 1 },
  fieldLabel: { ...type.caption, color: colors.textFaint },
  fieldValue: { ...type.headline, color: colors.text },
  barcode: { flexDirection: 'row', gap: 2, alignItems: 'flex-end', justifyContent: 'center' },
  stubCode: { ...type.caption, color: colors.textFaint, textAlign: 'center' },

  summary: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  sumTile: { flex: 1, padding: space.md },

  offerName: { ...type.subheadBold, color: colors.text },
  offerMeta: { ...type.caption, color: colors.textFaint },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  offerRight: { alignItems: 'flex-end' },
  offerPrice: { ...type.headline, color: colors.text },
  offerReduced: { ...type.caption, color: colors.textFaint },
});
