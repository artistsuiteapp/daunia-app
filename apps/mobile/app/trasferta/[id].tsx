import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, GroupLabel, GroupNote, Empty, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { Crest } from '../../components/Crest';
import { SoloConAccount } from '../../components/SoloConAccount';
import { Premi } from '../../components/anima';
import { colors, radius, space, type } from '../../theme/tokens';
import { longDate, time } from '../../lib/format';
import { matchById } from '../../lib/data';
import { useOspite } from '../../lib/ospite';
import {
  useTrasferte, divietoDi, perCitta, chiVa, contattoDi, ioSono,
  ciVado, nonCiVado, SPIEGAZIONI, MEZZI, type Mezzo,
} from '../../lib/trasferte';
import { CANALI, collegamento, etichetta, valido, type Canale } from '../../lib/contatti-core.ts';

/**
 * Una trasferta: se ci puoi andare, chi ci va, e come vi scrivete.
 *
 * IL CONTATTO E LA PARTE DELICATA
 *
 * Non c'e chat dentro l'app: si esce verso WhatsApp, Telegram, email o
 * Instagram. Ma un elenco di recapiti visibile a chiunque sarebbe una lista
 * pronta per chi raccoglie numeri, e il responsabile davanti alla legge e chi
 * gestisce l'app, non i tifosi.
 *
 * Quindi vale la reciprocita: il contatto lo vede solo chi ha dichiarato a sua
 * volta che va a QUELLA partita. Non e una furbizia tecnica, e la stessa cosa
 * che succede di persona: i numeri se li scambiano quelli che partono, non
 * quelli che guardano.
 *
 * A decidere e la policy del database, non questa schermata: qui i contatti
 * degli altri arrivano gia vuoti se non ne hai diritto.
 */
export default function Trasferta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gutter = useGutter();
  const ospite = useOspite();
  const match = matchById(String(id));

  useTrasferte(match ? [match.id] : []);

  const io = ioSono();
  const gente = chiVa(String(id));
  const mia = useMemo(() => gente.find((p) => p.utente === io) ?? null, [gente, io]);

  const [citta, setCitta] = useState('');
  const [mezzo, setMezzo] = useState<Mezzo>('macchina');
  const [posti, setPosti] = useState(0);
  const [nota, setNota] = useState('');
  const [canale, setCanale] = useState<Canale | null>(null);
  const [riferimento, setRiferimento] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  // se ci sono gia, il modulo parte da quello che avevo detto
  useEffect(() => {
    if (!mia) return;
    setCitta(mia.citta);
    setMezzo(mia.mezzo);
    setPosti(mia.posti);
    setNota(mia.nota ?? '');
    const c = contattoDi(String(id), mia.utente);
    if (c) { setCanale(c.canale); setRiferimento(c.riferimento); }
  }, [mia?.utente]);

  if (!match) return <Screen><Empty text="Trasferta non trovata." /></Screen>;

  const d = divietoDi(match.id);
  const s = SPIEGAZIONI[d.stato];
  const gruppi = perCitta(match.id);

  const contattoStorto = Boolean(canale && riferimento.trim() && !valido(canale, riferimento));
  const pronto = citta.trim().length >= 2 && !contattoStorto;

  const salva = async () => {
    setErrore(null);
    setInCorso(true);
    try {
      await ciVado(match.id, {
        citta, mezzo, posti: mezzo === 'macchina' ? posti : 0, nota,
        canale: riferimento.trim() ? canale : null,
        riferimento: riferimento.trim() || null,
      });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non è andata.');
    } finally {
      setInCorso(false);
    }
  };

  return (
    <Screen>
      <BackBar label="Trasferte" />

      <View style={[styles.testa, gutter]}>
        <Crest uri={match.home.crest} name={match.home.shortName} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={styles.titolo}>{match.home.shortName} – Foggia</Text>
          <Text style={styles.quando}>{longDate(match.kickoff)} · {time(match.kickoff)}</Text>
          {match.venue ? <Text style={styles.quando}>{match.venue}{match.city ? `, ${match.city}` : ''}</Text> : null}
        </View>
      </View>

      <View style={[styles.stato, s.grave ? styles.grave : styles.calmo, gutter]}>
        <Text style={styles.statoTitolo}>{s.titolo}</Text>
        <Text style={styles.statoTesto}>{s.chiPuo}</Text>
        {d.fonte_nome ? (
          <Premi onPress={() => d.fonte_url && Linking.openURL(d.fonte_url)} scala={1}>
            <Text style={styles.fonte}>Fonte: {d.fonte_nome} ›</Text>
          </Premi>
        ) : null}
      </View>

      {ospite ? (
        <View style={[gutter, { marginTop: space.md }]}>
          <SoloConAccount cosa="Per dire che ci vai, e per vedere i contatti di chi ci va, serve un account." />
        </View>
      ) : (
        <>
          <GroupLabel>{mia ? 'Ci vai' : 'Ci vado anch\'io'}</GroupLabel>
          <View style={[styles.modulo, gutter]}>
            <Campo etichetta="Da dove parti">
              <TextInput
                value={citta}
                onChangeText={setCitta}
                placeholder="Bologna"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                maxLength={60}
              />
            </Campo>

            <Campo etichetta="Come ci vai">
              <View style={styles.chips}>
                {(Object.keys(MEZZI) as Mezzo[]).map((m) => (
                  <Premi key={m} onPress={() => setMezzo(m)}>
                    <View style={[styles.chip, mezzo === m && styles.chipOn]}>
                      <Text style={[styles.chipTesto, mezzo === m && styles.chipTestoOn]}>{MEZZI[m]}</Text>
                    </View>
                  </Premi>
                ))}
              </View>
            </Campo>

            {mezzo === 'macchina' ? (
              <Campo etichetta="Posti liberi in macchina">
                <View style={styles.chips}>
                  {[0, 1, 2, 3, 4].map((n) => (
                    <Premi key={n} onPress={() => setPosti(n)}>
                      <View style={[styles.chip, posti === n && styles.chipOn]}>
                        <Text style={[styles.chipTesto, posti === n && styles.chipTestoOn]}>
                          {n === 0 ? 'nessuno' : n}
                        </Text>
                      </View>
                    </Premi>
                  ))}
                </View>
              </Campo>
            ) : null}

            <Campo etichetta="Una riga per organizzarsi (facoltativa)">
              <TextInput
                value={nota}
                onChangeText={setNota}
                placeholder="Parto alle 14 dal casello, passo da Firenze"
                placeholderTextColor={colors.textFaint}
                style={[styles.input, styles.inputAlto]}
                multiline
                maxLength={280}
              />
            </Campo>

            <View style={styles.contatti}>
              <Text style={styles.contattiTitolo}>Come ti scrivono (facoltativo)</Text>
              <Text style={styles.contattiNota}>
                Lo vede solo chi ha detto anche lui che va a questa partita. Chi guarda e basta,
                no. Puoi toglierlo quando vuoi.
              </Text>

              <View style={styles.chips}>
                {(Object.keys(CANALI) as Canale[]).map((c) => (
                  <Premi key={c} onPress={() => setCanale(canale === c ? null : c)}>
                    <View style={[styles.chip, canale === c && styles.chipOn]}>
                      <Text style={[styles.chipTesto, canale === c && styles.chipTestoOn]}>
                        {CANALI[c].nome}
                      </Text>
                    </View>
                  </Premi>
                ))}
              </View>

              {canale ? (
                <>
                  <TextInput
                    value={riferimento}
                    onChangeText={setRiferimento}
                    placeholder={CANALI[canale].esempio}
                    placeholderTextColor={colors.textFaint}
                    style={[styles.input, contattoStorto && styles.inputStorto]}
                    autoCapitalize="none"
                    keyboardType={canale === 'whatsapp' ? 'phone-pad' : 'default'}
                    maxLength={120}
                  />
                  {contattoStorto ? (
                    <Text style={styles.avvisoStorto}>
                      {canale === 'whatsapp'
                        ? 'Questo numero non torna. Scrivilo con il prefisso, per esempio +39 349 1234567.'
                        : 'Questo non sembra un contatto valido. Ricontrollalo.'}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>

            {errore ? <Text style={styles.errore}>{errore}</Text> : null}

            <Premi onPress={salva} disabled={!pronto || inCorso}>
              <View style={[styles.bottone, (!pronto || inCorso) && styles.bottoneSpento]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.onAccent} />
                <Text style={styles.bottoneTesto}>
                  {inCorso ? 'Un momento…' : mia ? 'Aggiorna' : 'Ci vado'}
                </Text>
              </View>
            </Premi>

            {mia ? (
              <Premi onPress={() => nonCiVado(match.id)} scala={1}>
                <Text style={styles.annulla}>Non ci vado più</Text>
              </Premi>
            ) : null}
          </View>
        </>
      )}

      <GroupLabel>{gente.length ? `Ci vanno in ${gente.length}` : 'Chi ci va'}</GroupLabel>

      {!gruppi.length ? (
        <View style={gutter}><Text style={styles.vuoto}>Nessuno ancora. Se ci vai, dillo: è così che si trovano gli altri.</Text></View>
      ) : (
        gruppi.map((g) => (
          <View key={g.citta} style={[styles.gruppo, gutter]}>
            <Text style={styles.cittaNome}>{g.citta.toUpperCase()}</Text>
            {g.gente.map((p) => {
              const c = contattoDi(match.id, p.utente);
              const link = c ? collegamento(c.canale, c.riferimento) : null;
              return (
                <View key={p.utente} style={styles.persona}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personaMezzo}>
                      {MEZZI[p.mezzo]}
                      {p.posti > 0 ? ` · ${p.posti} ${p.posti === 1 ? 'posto libero' : 'posti liberi'}` : ''}
                      {p.utente === io ? ' · sei tu' : ''}
                    </Text>
                    {p.nota ? <Text style={styles.personaNota}>{p.nota}</Text> : null}
                  </View>
                  {link ? (
                    <Premi onPress={() => Linking.openURL(link)}>
                      <View style={styles.scrivi}>
                        <Ionicons name="open-outline" size={13} color={colors.onAccent} />
                        <Text style={styles.scriviTesto}>{etichetta(c!.canale, c!.riferimento)}</Text>
                      </View>
                    </Premi>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))
      )}

      <GroupNote>
        Il divieto lo decide il Prefetto e cambia da partita a partita: qui arriva dalla stampa
        locale e viene confermato a mano, non è la fonte ufficiale. I contatti li lascia chi vuole
        e li vede solo chi va a questa trasferta. Si condivide un viaggio, mai un biglietto.
      </GroupNote>
    </Screen>
  );
}

function Campo({ etichetta: e, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.campoEtichetta}>{e}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  testa: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  titolo: { ...type.title2, color: colors.text },
  quando: { ...type.caption, color: colors.textDim },

  stato: { borderRadius: radius.lg, padding: space.md, marginTop: space.md, gap: 3 },
  grave: { backgroundColor: colors.accentSoft },
  calmo: { backgroundColor: colors.surface },
  statoTitolo: { ...type.headline, color: colors.text },
  statoTesto: { ...type.subhead, color: colors.textDim },
  fonte: { ...type.caption, color: colors.accentBright, marginTop: 4 },

  modulo: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.md },
  campoEtichetta: { ...type.captionBold, color: colors.textDim, letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.surfaceHi, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: 11,
    ...type.body, color: colors.text,
    borderWidth: 1, borderColor: 'transparent',
  },
  inputAlto: { minHeight: 74, textAlignVertical: 'top' },
  inputStorto: { borderColor: colors.accentBright },
  avvisoStorto: { ...type.caption, color: colors.accentBright },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.surfaceHi, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.accent },
  chipTesto: { ...type.caption, color: colors.textDim },
  chipTestoOn: { color: colors.onAccent },

  contatti: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: space.md },
  contattiTitolo: { ...type.footnoteBold, color: colors.text },
  contattiNota: { ...type.caption, color: colors.textDim },

  errore: { ...type.caption, color: colors.accentBright },
  bottone: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: space.md,
  },
  bottoneSpento: { backgroundColor: colors.surfaceHi },
  bottoneTesto: { ...type.headline, color: colors.onAccent },
  annulla: { ...type.subhead, color: colors.textDim, textAlign: 'center', paddingVertical: 6 },

  vuoto: { ...type.subhead, color: colors.textDim },
  gruppo: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, marginTop: space.sm, gap: space.sm },
  cittaNome: { ...type.captionBold, color: colors.textDim, letterSpacing: 0.6 },
  persona: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  personaMezzo: { ...type.subhead, color: colors.text },
  personaNota: { ...type.caption, color: colors.textDim, marginTop: 2 },
  scrivi: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  scriviTesto: { ...type.caption, color: colors.onAccent },
});
