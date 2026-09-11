import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Card, GroupLabel, GroupNote, ListGroup, ListRow, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { Avatar } from '../../components/Avatar';
import { MvpDelMese } from '../../components/MvpDelMese';
import { colors, radius, space, type } from '../../theme/tokens';
import { squad } from '../../lib/data';
import { useUltimaPartita } from '../../lib/partita-corrente';
import { shortDate } from '../../lib/format';
import { caricaMvpPartita, classificaMvp, useFanplay } from '../../lib/fanplay';
import { statoMigliore } from '../../lib/premi-core';
import { fineVera } from '../../lib/live';

/**
 * I premi: il migliore della partita e il migliore del mese.
 *
 * PRIMA SI SPIEGA, POI SI MOSTRA
 *
 * Sono due premi diversi con due regole diverse, e chi apre questa schermata la
 * prima volta non ha modo di indovinarle: uno si vota a caldo e dura un giorno,
 * l'altro si vota per tutto il mese e chiude a mezzanotte dell'ultimo giorno.
 * Senza quelle due righe scritte sopra, un premio che sparisce sembra un guasto.
 */
export default function Premi() {
  const gutter = useGutter();
  useFanplay();

  const ultima = useUltimaPartita();
  const stato = statoMigliore(fineVera() ?? ultima?.kickoff ?? null, undefined);

  useEffect(() => {
    if (ultima) void caricaMvpPartita(ultima.id);
  }, [ultima?.id]);

  const preferenze = ultima ? classificaMvp(ultima.id) : [];
  const vincitore = preferenze[0] ?? null;
  const totale = preferenze.reduce((n, p) => n + p.voti, 0);

  return (
    <Screen>
      <BackBar label="Match Center" />

      <View style={[gutter, { marginTop: space.sm }]}>
        <Text style={styles.titolo}>I premi</Text>
        <Text style={styles.sotto}>
          Due riconoscimenti votati dalla Curva, non dalla redazione.
        </Text>
      </View>

      <View style={[gutter, { marginTop: space.lg }]}>
        <Card style={styles.spiega}>
          <Riga
            icona="star"
            titolo="Il migliore della partita"
            testo="Si vota nelle ventiquattr’ore dopo il fischio finale, scegliendo un nome solo fra chi è sceso in campo. Servono almeno tre voti perché il verdetto compaia. Poi resta lì fino al giorno prima della gara successiva."
          />
          <Riga
            icona="trophy"
            titolo="Il migliore del mese"
            testo="Si vota per tutto il mese e si può cambiare idea fino all’ultimo giorno. Si sceglie fra chi ha giocato almeno una partita di quel mese. A mezzanotte del primo il mese chiude e il verdetto resta."
          />
        </Card>
      </View>

      {/* ------------------------------------------ il migliore della partita */}

      <GroupLabel>
        {ultima ? `${ultima.home.shortName}–${ultima.away.shortName}` : 'Ultima partita'}
      </GroupLabel>

      {!ultima ? (
        <GroupNote>Non si è ancora giocato niente.</GroupNote>
      ) : vincitore ? (
        <View style={gutter}>
          <Card style={styles.vincitore}>
            <Avatar uri={fotoDi(vincitore.giocatore)} name={vincitore.giocatore} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nome}>{vincitore.giocatore}</Text>
              <Text style={styles.meta}>
                {vincitore.voti} {vincitore.voti === 1 ? 'preferenza' : 'preferenze'}
                {totale > vincitore.voti ? ` su ${totale}` : ''} · {shortDate(ultima.kickoff)}
              </Text>
            </View>
            <Ionicons name="star" size={22} color="#E8C547" />
          </Card>

          {preferenze.length > 1 ? (
            <View style={{ marginTop: space.sm }}>
              <ListGroup>
                {preferenze.slice(1, 5).map((p, i) => (
                  <ListRow key={p.giocatore} right={<Text style={styles.voti}>{p.voti}</Text>}>
                    <Text style={styles.posizione}>{i + 2}</Text>
                    <Text style={styles.altro} numberOfLines={1}>{p.giocatore}</Text>
                  </ListRow>
                ))}
              </ListGroup>
            </View>
          ) : null}
        </View>
      ) : (
        <GroupNote>
          {stato.fase === 'votazione'
            ? 'Si sta votando adesso: il verdetto compare quando almeno tre persone hanno scelto.'
            : 'Per questa partita non è arrivato nessun voto.'}
        </GroupNote>
      )}

      {/* ---------------------------------------------- il migliore del mese */}

      <MvpDelMese />
    </Screen>
  );
}

/** La foto del giocatore, se ce l'abbiamo: quasi mai, e il segnaposto va bene. */
function fotoDi(nome: string): string | null {
  const p = squad.find((x) => x.name === nome || x.shortName === nome);
  return p?.photo ?? null;
}

function Riga({ icona, titolo, testo }: {
  icona: keyof typeof Ionicons.glyphMap; titolo: string; testo: string;
}) {
  return (
    <View style={styles.rigaSpiega}>
      <Ionicons name={icona} size={18} color={colors.accentBright} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.rigaTitolo}>{titolo}</Text>
        <Text style={styles.rigaTesto}>{testo}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titolo: { ...type.displayTitle, color: colors.text },
  sotto: { ...type.footnote, color: colors.textDim, marginTop: 4 },

  spiega: { padding: space.lg, gap: space.lg },
  rigaSpiega: { flexDirection: 'row', gap: space.md },
  rigaTitolo: { ...type.subheadBold, color: colors.text },
  rigaTesto: { ...type.footnote, color: colors.textDim, lineHeight: 19 },

  vincitore: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg,
    borderWidth: 1, borderColor: 'rgba(232,197,71,0.35)', borderRadius: radius.lg,
  },
  nome: { ...type.headline, color: colors.text },
  meta: { ...type.caption, color: colors.textDim, marginTop: 2 },

  posizione: { ...type.footnoteBold, color: colors.textFaint, width: 20 },
  altro: { ...type.subhead, color: colors.text, flex: 1 },
  voti: { ...type.subheadBold, color: colors.textDim },
});
