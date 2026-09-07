import { Linking, StyleSheet, Text, View } from 'react-native';
import type { TicketOffer } from '@satanelli/core';

import {
  Screen, LargeTitle, ListGroup, ListRow, GroupLabel, GroupNote, Button, useGutter,
} from '../components/ui';
import { BackBar } from '../components/BackBar';
import { EventCard } from '../components/EventCard';
import { brand } from '../theme/brand';
import { colors, space, type } from '../theme/tokens';
import { thousands } from '../lib/format';
import { FOGGIA, nextHomeMatch, tickets } from '../lib/data';

/**
 * Biglietti.
 *
 * Questa schermata prima mostrava un tagliando disegnato con settore, fila,
 * posto e un codice a barre, piu "5347 disponibili su 14.530", i prezzi e il
 * ridotto. Niente di tutto quello era vero: la disponibilita usciva da
 * un'occupazione simulata, il ridotto era il sessanta per cento del pieno, e
 * il pieno era una stima scritta a mano.
 *
 * Il tagliando col codice a barre e la cosa peggiore che ci fosse: in un'app
 * di tifosi, in un paese dove il secondary ticketing e sanzionato, disegnare
 * qualcosa che somiglia a un titolo d'ingresso non e un mockup innocuo. E via.
 *
 * Resta quello che e vero: quali settori esistono, se sono coperti, quanto
 * tengono all'incirca, e il link a chi vende davvero.
 */
export default function Tickets() {
  const gutter = useGutter();
  const match = nextHomeMatch();

  return (
    <Screen testaFissa>
      <BackBar />
      <LargeTitle
        crest={FOGGIA?.crest ?? null}
        title="Biglietti"
        subtitle={`Zaccheria · vendita su ${brand.ticketProvider.name}`}
      />

      {match ? (
        <>
          <GroupLabel>Prossima in casa</GroupLabel>
          <View style={gutter}><EventCard match={match} tone="accent" /></View>
        </>
      ) : null}

      <View style={[gutter, { marginTop: space.xl }]}>
        <Button
          label={`Apri ${brand.ticketProvider.name}`}
          icon="open-outline"
          onPress={() => Linking.openURL(brand.ticketProvider.url)}
        />
      </View>

      <GroupLabel>I settori dello Zaccheria</GroupLabel>
      <View style={gutter}>
        <ListGroup>
          {tickets.map((t) => <SectorRow key={t.id} offer={t} />)}
        </ListGroup>
      </View>

      <GroupNote>
        Prezzi e disponibilità non sono qui perché non li abbiamo: li pubblica
        {' '}{brand.ticketProvider.name}, ed è lì che vanno letti. Le capienze sono indicative.
        Quando il club aprirà i dati di biglietteria, questa pagina li mostrerà.
      </GroupNote>
    </Screen>
  );
}

function SectorRow({ offer }: { offer: TicketOffer }) {
  return (
    <ListRow onPress={() => Linking.openURL(offer.ticketUrl)} chevron height={58}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.nome}>{offer.sectorName}</Text>
        <Text style={styles.meta}>
          {offer.covered ? 'coperto' : 'scoperto'}
          {offer.capacity ? ` · circa ${thousands(offer.capacity)} posti` : ''}
        </Text>
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  nome: { ...type.body, color: colors.text },
  meta: { ...type.footnote, color: colors.textDim },
});
