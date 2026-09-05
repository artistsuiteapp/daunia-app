import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, LargeTitle, GroupLabel, GroupNote, Empty, useGutter } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Avatar } from '../components/Avatar';
import { Reveal } from '../components/Reveal';
import { SoloConAccount } from '../components/SoloConAccount';
import { Premi, Numero, Fiamma, Coriandoli, Timbro } from '../components/anima';
import { colors, radius, space, type } from '../theme/tokens';
import { shortDate } from '../lib/format';
import { FOGGIA, squad, leagueMatches, nextMatch } from '../lib/data';
import { realLineup, idsUfficiali } from '../lib/lineup';
import { useOspite } from '../lib/ospite';
import { confronta, ROSA_XI, BONUS_PIENO } from '../lib/curva-core';
import { useCurva, miaFormazione, schiera, undiciCurva, striscia } from '../lib/curva';

/**
 * La Formazione della Curva.
 *
 * Nasce da un buco vero: le formazioni ufficiali escono verso un'ora dal
 * fischio d'inizio e prima non esistono da nessuna parte, nemmeno a pagamento.
 * Per sei giorni su sette "chi deve giocare" e una domanda senza risposta
 * pubblica, ed e esattamente la domanda di cui i tifosi parlano tutta la
 * settimana.
 *
 * Quindi la risposta la danno loro. Si schiera un undici, si vede quello della
 * curva prendere forma voto dopo voto, e a un'ora dal fischio arriva quello
 * vero e si scopre chi aveva ragione. La striscia tiene il conto delle giornate
 * di fila: e la ragione per riaprire l'app di mercoledi, non solo la domenica.
 *
 * Senza account si puo schierare lo stesso, ma resta sul telefono e non entra
 * nel conteggio. E scritto prima di premere, non dopo.
 */
export default function Formazione() {
  const gutter = useGutter();
  const ospite = useOspite();

  const prossima = nextMatch();
  useCurva(prossima?.id ?? null);

  const giocate = useMemo(
    () => leagueMatches()
      .filter((m) => m.status === 'finished' && m.kickoff)
      .sort((a, b) => Date.parse(a.kickoff!) - Date.parse(b.kickoff!))
      .map((m) => m.id),
    [],
  );

  const mia = prossima ? miaFormazione(prossima.id) : [];
  const [scelti, setScelti] = useState<string[]>(mia);
  const [appenaSchierata, setAppenaSchierata] = useState(false);

  const rosa = useMemo(() => [...squad].sort((a, b) => (a.number ?? 999) - (b.number ?? 999)), []);
  const curva = prossima ? undiciCurva(prossima.id) : { voci: [], votanti: 0, solaMia: false };
  const consenso = new Map(curva.voci.map((v) => [v.id, v.percento]));
  const giornate = striscia(giocate);

  // il verdetto dell'ultima partita: la propria formazione contro quella vera
  const ultima = realLineup();
  const verdetto = useMemo(() => {
    if (!ultima) return null;
    const partita = leagueMatches().find((m) => m.kickoff?.slice(0, 10) === ultima.date);
    if (!partita) return null;
    const schierata = miaFormazione(partita.id);
    if (schierata.length < ROSA_XI) return null;
    return { partita, esito: confronta(schierata, idsUfficiali(ultima)) };
  }, [ultima]);

  const scegli = (id: string) => {
    setScelti((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= ROSA_XI) return p;
      return [...p, id];
    });
    setAppenaSchierata(false);
  };

  const conferma = async () => {
    if (!prossima || scelti.length !== ROSA_XI) return;
    await schiera(prossima.id, scelti);
    setAppenaSchierata(true);
  };

  const nome = (id: string) => squad.find((p) => p.id === id)?.shortName ?? '—';

  return (
    <Screen>
      <BackBar label="Home" />
      <LargeTitle
        crest={FOGGIA?.crest ?? null}
        title="La formazione della Curva"
        subtitle="L'undici lo decidi tu, tutta la settimana"
      />

      {giornate > 0 ? (
        <Reveal>
          <View style={[styles.striscia, gutter]}>
            <Fiamma giornate={giornate} />
            {giornate >= 2 ? (
              <Text style={styles.avviso}>Salta una giornata e riparti da zero.</Text>
            ) : null}
          </View>
        </Reveal>
      ) : null}

      {verdetto ? (
        <Reveal delay={60}>
          <View style={{ position: 'relative' }}>
            <Coriandoli attivo={verdetto.esito.pieno} />
            <GroupLabel>Com'è andata</GroupLabel>
            <View style={[styles.verdetto, gutter]}>
              <Timbro>
                <View style={styles.punteggio}>
                  <Numero valore={verdetto.esito.punti} stile={styles.punti} />
                  <Text style={styles.puntiEtichetta}>
                    {verdetto.esito.punti === 1 ? 'punto' : 'punti'}
                  </Text>
                </View>
              </Timbro>
              <Text style={styles.verdettoTesto}>
                {verdetto.esito.pieno
                  ? `Undici su undici. ${BONUS_PIENO} punti di bonus.`
                  : `${verdetto.esito.azzeccati.length} su ${ROSA_XI} contro ${verdetto.partita.home.shortName} – ${verdetto.partita.away.shortName}.`}
              </Text>
              <View style={styles.nomi}>
                {verdetto.esito.azzeccati.map((id) => (
                  <View key={id} style={[styles.nome, styles.giusto]}>
                    <Ionicons name="checkmark" size={13} color="#111" />
                    <Text style={styles.nomeGiusto}>{nome(id)}</Text>
                  </View>
                ))}
                {verdetto.esito.sbagliati.map((id) => (
                  <View key={id} style={[styles.nome, styles.errato]}>
                    <Text style={styles.nomeErrato}>{nome(id)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Reveal>
      ) : null}

      {!prossima ? (
        <Empty text="Nessuna partita in programma." />
      ) : (
        <>
          <GroupLabel>
            {`Per ${prossima.home.shortName} – ${prossima.away.shortName}, ${shortDate(prossima.kickoff)}`}
          </GroupLabel>

          {curva.voci.length ? (
            <Reveal delay={100}>
              <View style={[styles.curva, gutter]}>
                <Text style={styles.curvaTitolo}>
                  {curva.solaMia
                    ? 'Per ora c\'è solo la tua'
                    : `L'undici della curva · ${curva.votanti} ${curva.votanti === 1 ? 'tifoso' : 'tifosi'}`}
                </Text>
                {curva.voci.slice(0, ROSA_XI).map((v, i) => (
                  <View key={v.id} style={styles.barraRiga}>
                    <Text style={styles.barraNome} numberOfLines={1}>{i + 1}. {nome(v.id)}</Text>
                    <View style={styles.barraFondo}>
                      <View style={[styles.barraPieno, { width: `${Math.max(6, v.percento)}%` }]} />
                    </View>
                    <Text style={styles.barraPerc}>{v.percento}%</Text>
                  </View>
                ))}
              </View>
            </Reveal>
          ) : null}

          <GroupLabel>{`La tua · ${scelti.length} di ${ROSA_XI}`}</GroupLabel>
          <View style={[styles.griglia, gutter]}>
            {rosa.map((p) => {
              const dentro = scelti.includes(p.id);
              const perc = consenso.get(p.id);
              return (
                <Premi key={p.id} onPress={() => scegli(p.id)} style={styles.cella}>
                  <View style={[styles.pastiglia, dentro && styles.pastigliaDentro]}>
                    <Avatar uri={p.photo} name={p.name} size={38} />
                    <Text style={[styles.numero, dentro && styles.numeroDentro]}>{p.number ?? '–'}</Text>
                    <Text style={[styles.cognome, dentro && styles.cognomeDentro]} numberOfLines={1}>
                      {p.shortName}
                    </Text>
                    {perc !== undefined ? <Text style={styles.consenso}>{perc}%</Text> : null}
                  </View>
                </Premi>
              );
            })}
          </View>

          <View style={[gutter, { marginTop: space.lg }]}>
            <Premi onPress={conferma} disabled={scelti.length !== ROSA_XI}>
              <View style={[styles.conferma, scelti.length !== ROSA_XI && styles.confermaSpenta]}>
                <Ionicons
                  name={appenaSchierata ? 'checkmark-circle' : 'football'}
                  size={18}
                  color={colors.onAccent}
                />
                <Text style={styles.confermaTesto}>
                  {appenaSchierata
                    ? 'Schierata'
                    : scelti.length === ROSA_XI ? 'Schiera la tua formazione' : `Scegline ancora ${ROSA_XI - scelti.length}`}
                </Text>
              </View>
            </Premi>
          </View>

          {ospite ? (
            <View style={{ marginTop: space.md }}>
              <SoloConAccount cosa="Senza account la tua formazione resta su questo telefono e non entra nel conteggio della curva." />
            </View>
          ) : null}

          <GroupNote>
            Le formazioni ufficiali escono circa un'ora prima del fischio d'inizio: fino a quel
            momento questa è l'unica in circolazione. Quando arriva quella vera si vede chi
            aveva ragione: un punto per ogni nome giusto, {BONUS_PIENO} di bonus se sono giusti tutti.
          </GroupNote>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  striscia: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: space.md, paddingHorizontal: space.md, marginTop: space.md,
  },
  avviso: { ...type.caption, color: colors.textDim, flexShrink: 1, textAlign: 'right' },

  verdetto: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: space.lg, gap: space.md, alignItems: 'center',
  },
  punteggio: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  punti: { ...type.score, color: colors.accentBright },
  puntiEtichetta: { ...type.headline, color: colors.textDim },
  verdettoTesto: { ...type.subhead, color: colors.text, textAlign: 'center' },
  nomi: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  nome: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  giusto: { backgroundColor: '#32D74B' },
  errato: { backgroundColor: colors.surfaceHi },
  nomeGiusto: { ...type.captionBold, color: '#111' },
  nomeErrato: { ...type.caption, color: colors.textFaint, textDecorationLine: 'line-through' },

  curva: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: 7 },
  curvaTitolo: { ...type.footnoteBold, color: colors.textDim, marginBottom: 2 },
  barraRiga: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barraNome: { ...type.caption, color: colors.text, width: 108 },
  barraFondo: { flex: 1, height: 7, borderRadius: 4, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  barraPieno: { height: 7, borderRadius: 4, backgroundColor: colors.accentBright },
  barraPerc: { ...type.caption, color: colors.textDim, width: 34, textAlign: 'right' },

  griglia: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cella: { width: 78 },
  pastiglia: {
    alignItems: 'center', gap: 2, paddingVertical: space.sm, paddingHorizontal: 4,
    borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 2, borderColor: 'transparent',
  },
  pastigliaDentro: { backgroundColor: colors.accentSoft, borderColor: colors.accentBright },
  numero: { ...type.captionBold, color: colors.textDim },
  numeroDentro: { color: colors.accentBright },
  cognome: { ...type.caption, color: colors.textDim, maxWidth: 70 },
  cognomeDentro: { color: colors.text },
  consenso: { ...type.caption, color: colors.textFaint, fontSize: 10 },

  conferma: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: space.md,
  },
  confermaSpenta: { backgroundColor: colors.surfaceHi },
  confermaTesto: { ...type.headline, color: colors.onAccent },
});
