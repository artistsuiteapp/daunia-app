import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, LargeTitle, GroupLabel, GroupNote, ListGroup, ListRow, useGutter } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Premi } from '../components/anima';
import { colors, radius, space, type } from '../theme/tokens';
import { FOGGIA } from '../lib/data';
import {
  statoNotifiche, accendi, spegni, cambiaPreferenze, provaLocale,
  ETICHETTE, PREFERENZE_INIZIALI, type Preferenze, type Stato,
} from '../lib/notifiche';

/**
 * Notifiche del match-day.
 *
 * La schermata deve spiegare, non solo commutare. Su iPhone le notifiche
 * arrivano soltanto se l'app e stata aggiunta alla schermata Home: se questa
 * pagina si limitasse a dire "non disponibili", una persona che poteva
 * riceverle rinuncerebbe senza sapere perche.
 *
 * Il permesso si chiede quando l'utente preme, mai all'apertura. Su iOS un
 * permesso negato non si puo piu richiedere: chiederlo di sorpresa vuol dire
 * bruciarlo per sempre.
 */
export default function Notifiche() {
  const gutter = useGutter();
  const [stato, setStato] = useState<Stato | null>(null);
  const [preferenze, setPreferenze] = useState<Preferenze>(PREFERENZE_INIZIALI);
  const [inCorso, setInCorso] = useState(false);

  const aggiorna = useCallback(async () => {
    const s = await statoNotifiche();
    setStato(s);
    if (s.modo === 'attive' || s.modo === 'attive-non-salvate') setPreferenze(s.preferenze);
  }, []);

  useEffect(() => { void aggiorna(); }, [aggiorna]);

  const commuta = async () => {
    setInCorso(true);
    const s = stato?.modo === 'attive' ? await spegni() : await accendi(preferenze);
    setStato(s);
    if (s.modo === 'attive' || s.modo === 'attive-non-salvate') setPreferenze(s.preferenze);
    setInCorso(false);
  };

  const cambia = async (chiave: keyof Preferenze, valore: boolean) => {
    const nuove = { ...preferenze, [chiave]: valore };
    setPreferenze(nuove);
    await cambiaPreferenze(nuove);
  };

  const attive = stato?.modo === 'attive' || stato?.modo === 'attive-non-salvate';

  return (
    <Screen testaFissa>
      <BackBar label="Home" />
      <LargeTitle
        crest={FOGGIA?.crest ?? null}
        title="Notifiche"
        subtitle="Quello che succede in partita, mentre succede"
      />

      {stato === null ? null : stato.modo === 'aggiungi-alla-home' ? (
        <View style={[styles.spiega, gutter]}>
          <Ionicons name="phone-portrait-outline" size={22} color={colors.accentBright} />
          <Text style={styles.spiegaTitolo}>Prima aggiungi l'app alla schermata Home</Text>
          <Text style={styles.spiegaTesto}>
            Su iPhone le notifiche arrivano solo alle app aggiunte alla Home. È una regola di
            Apple, non una scelta nostra.
          </Text>
          <View style={styles.passi}>
            <Passo n={1} testo="Tocca il pulsante Condividi, quello con la freccia verso l'alto." />
            <Passo n={2} testo="Scorri e scegli «Aggiungi a Home»." />
            <Passo n={3} testo="Apri l'app dall'icona sulla Home e torna qui." />
          </View>
        </View>
      ) : stato.modo === 'negato' ? (
        <View style={[styles.spiega, gutter]}>
          <Ionicons name="notifications-off-outline" size={22} color={colors.textDim} />
          <Text style={styles.spiegaTitolo}>Le notifiche sono bloccate</Text>
          <Text style={styles.spiegaTesto}>
            Le hai rifiutate una volta e il browser non ce lo fa richiedere. Si riattivano dalle
            impostazioni del telefono, alla voce di questo sito.
          </Text>
        </View>
      ) : stato.modo === 'non-supportate' ? (
        <View style={[styles.spiega, gutter]}>
          <Ionicons name="alert-circle-outline" size={22} color={colors.textDim} />
          <Text style={styles.spiegaTitolo}>Qui non arrivano</Text>
          <Text style={styles.spiegaTesto}>
            {Platform.OS === 'web'
              ? 'Questo browser non supporta le notifiche push. Su iPhone serve iOS 16.4 o più recente.'
              : 'In questa versione installata non arrivano: Apple le concede solo alle app firmate con un account sviluppatore a pagamento. Nel frattempo le ricevi dalla versione web aggiunta alla schermata Home.'}
          </Text>
        </View>
      ) : (
        <>
          <View style={gutter}>
            <Premi onPress={commuta} disabled={inCorso}>
              <View style={[styles.bottone, attive && styles.bottoneSpento]}>
                <Ionicons
                  name={attive ? 'notifications' : 'notifications-outline'}
                  size={18}
                  color={attive ? colors.text : colors.onAccent}
                />
                <Text style={[styles.bottoneTesto, attive && { color: colors.text }]}>
                  {inCorso ? 'Un momento…' : attive ? 'Spegni le notifiche' : 'Accendi le notifiche'}
                </Text>
              </View>
            </Premi>
          </View>

          {stato.modo === 'attive-non-salvate' ? (
            <View style={[styles.guasto, gutter]}>
              <Ionicons name="warning-outline" size={18} color="#FFB020" />
              <Text style={styles.guastoTesto}>
                Il telefono è pronto, ma il server non ha registrato l'iscrizione, quindi le
                notifiche non arriverebbero. Riprova fra poco: {stato.motivo}
              </Text>
            </View>
          ) : null}

          {attive ? (
            <>
              <GroupLabel>Cosa vuoi che ti arrivi</GroupLabel>
              <ListGroup>
                {(Object.keys(ETICHETTE) as Array<keyof Preferenze>).map((k) => (
                  <ListRow
                    key={k}
                    right={(
                      <Switch
                        value={preferenze[k]}
                        onValueChange={(v) => cambia(k, v)}
                        trackColor={{ true: colors.accent, false: colors.surfaceHi }}
                        thumbColor={colors.text}
                      />
                    )}
                  >
                    <Text style={styles.riga}>{ETICHETTE[k]}</Text>
                  </ListRow>
                ))}
              </ListGroup>
              <View style={[gutter, { marginTop: space.md }]}>
                <Premi onPress={() => { void provaLocale(); }}>
                  <View style={styles.prova}>
                    <Ionicons name="flask-outline" size={16} color={colors.accentBright} />
                    <Text style={styles.provaTesto}>Mandami una notifica di prova</Text>
                  </View>
                </Premi>
              </View>

              <GroupNote>
                Arrivano solo nei giorni di partita, dal riscaldamento al fischio finale. Fuori da
                lì l'app non ti scrive: una notifica di martedì la spegneresti e basta.
              </GroupNote>
            </>
          ) : (
            <GroupNote>
              Ti avvisiamo quando escono le formazioni, quando si comincia, a ogni gol e a fine
              partita. Con un ritardo di un minuto o due sulla diretta: prendiamo i dati da una
              fonte gratuita, e quella è la sua velocità.
            </GroupNote>
          )}
        </>
      )}
    </Screen>
  );
}

function Passo({ n, testo }: { n: number; testo: string }) {
  return (
    <View style={styles.passo}>
      <View style={styles.pallino}><Text style={styles.pallinoTesto}>{n}</Text></View>
      <Text style={styles.passoTesto}>{testo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  spiega: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: space.lg, gap: space.sm, marginTop: space.md,
  },
  spiegaTitolo: { ...type.headline, color: colors.text },
  spiegaTesto: { ...type.subhead, color: colors.textDim },
  passi: { gap: space.sm, marginTop: space.sm },
  passo: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  pallino: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  pallinoTesto: { ...type.captionBold, color: colors.accentBright },
  passoTesto: { ...type.subhead, color: colors.text, flex: 1 },

  bottone: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: space.md,
    marginTop: space.md,
  },
  bottoneSpento: { backgroundColor: colors.surfaceHi },
  bottoneTesto: { ...type.headline, color: colors.onAccent },
  riga: { ...type.body, color: colors.text },
  guasto: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: 'rgba(255,176,32,0.12)', borderRadius: radius.md,
    padding: space.md, marginTop: space.md,
  },
  guastoTesto: { ...type.caption, color: colors.text, flex: 1 },
  prova: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    borderRadius: radius.lg, paddingVertical: space.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  provaTesto: { ...type.subhead, color: colors.accentBright },
});
