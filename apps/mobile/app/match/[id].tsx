import { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  Screen, ListGroup, ListRow, GroupLabel, GroupNote, Empty, Badge, Button, Segmented, useGutter,
} from '../../components/ui';
import { Lineup } from '../../components/Lineup';
import { Avatar } from '../../components/Avatar';
import { lineupPerPartita } from '../../lib/lineup';
import { BackBar } from '../../components/BackBar';
import { Crest } from '../../components/Crest';
import { Countdown } from '../../components/Countdown';
import { colors, radius, space, type } from '../../theme/tokens';
import { longDate, shortDate, thousands } from '../../lib/format';
import { matchById, matches } from '../../lib/data';
import { Pagelle } from '../../components/Pagelle';
import { Pronostico } from '../../components/Pronostico';
import { useDatiPartita } from '../../lib/fanplay';
import { useLive, liveDi, useGolVivo } from '../../lib/live';
import { etichettaFase } from '../../lib/live-core';

type Tab = 'formazione' | 'gioco' | 'eventi' | 'dati';

export default function MatchDetail() {
  // `tab` permette di aprire la scheda gia sulla sezione giusta: il richiamo
  // delle pagelle in home portava qui ma sulla formazione, e bisognava
  // cercarla a mano proprio nel momento in cui uno vuole solo votare
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const gutter = useGutter();
  const TAB_VALIDE: Tab[] = ['eventi', 'formazione', 'gioco', 'dati'];
  const [view, setView] = useState<Tab>(
    TAB_VALIDE.includes(tab as Tab) ? (tab as Tab) : 'eventi',
  );
  const match = matchById(String(id));
  const vivo = liveDi(match, useLive());
  // la cronologia che il guardiano registra mentre si gioca: minuto e punteggio,
  // senza il nome di chi ha segnato
  const golVivo = useGolVivo();

  /**
   * La cronaca: gol, cartellini e cambi in un elenco solo, in ordine di minuto.
   *
   * Prima si vedevano solo i gol, e per Foggia-Cerignola erano due righe in
   * novanta minuti. Cartellini e sostituzioni c'erano gia nei dati e restavano
   * inutilizzati: sono quelli che raccontano come e andata la partita fra un
   * gol e l'altro.
   */
  const cronaca = useMemo(() => {
    if (!match) return [];
    type Voce = { minuto: number; inCasa: boolean; testo: string; icona: keyof typeof Ionicons.glyphMap };
    const voci: Voce[] = [];

    for (const g of match.goals ?? []) {
      voci.push({
        // il minuto puo mancare nei dati di Wikipedia: in fondo, non in cima
        minuto: (g.minute ?? 999) + (g.extra ?? 0),
        inCasa: g.side === 'home',
        testo: `${g.scorer}${g.penalty ? ' (rig.)' : ''}${g.ownGoal ? ' (aut.)' : ''}`,
        icona: 'football',
      });
    }
    for (const c of match.cards ?? []) {
      voci.push({
        minuto: c.minute,
        inCasa: c.side === 'home',
        testo: c.player ?? 'espulso',
        // il rosso ha un'icona sua: in un elenco lungo il colore da solo non basta
        icona: c.rosso ? 'close-circle' : 'square',
      });
    }
    for (const sc of match.subs ?? []) {
      voci.push({
        minuto: sc.minute,
        inCasa: sc.side === 'home',
        testo: sc.entra && sc.esce ? `${sc.entra} ← ${sc.esce}` : (sc.entra ?? sc.esce ?? 'cambio'),
        icona: 'swap-horizontal',
      });
    }
    return voci.sort((a, b) => a.minuto - b.minuto);
  }, [match]);
  const lineup = useMemo(
    () => lineupPerPartita(match?.kickoff ? match.kickoff.slice(0, 10) : undefined),
    [match?.kickoff],
  );
  useDatiPartita(match?.id ?? null, true);

  if (!match) return <Screen testaFissa><Empty text="Partita non trovata." /></Screen>;

  /*
   * Giocata.
   *
   * Il calendario viene da Wikipedia, che mette lo stato "finished" con ore di
   * ritardo: fidarsi solo di quello vuol dire mostrare il Pronostico e non le
   * Pagelle proprio nell'ora in cui la gente vuole votare. La fonte dal vivo
   * sa del triplice fischio subito, e qui vale quanto il calendario.
   */
  const played = match.status === 'finished' || Boolean(vivo?.finita);
  const h2h = matches.filter(
    (m) => m.id !== match.id && m.status === 'finished'
      && ((m.home.id === match.home.id && m.away.id === match.away.id)
        || (m.home.id === match.away.id && m.away.id === match.home.id)),
  );
  const label = match.competition === 'Serie C' && match.matchday
    ? `${match.matchday}ª giornata` : match.competition;

  return (
    <Screen>
      <BackBar label="Partite" />

      <View style={[styles.scoreboard, gutter]}>
        <Badge label={label} tone="accent" />
        <View style={styles.teams}>
          <Side team={match.home} />
          <View style={styles.centre}>
            {vivo
              ? <Text style={styles.score}>{vivo.casa ?? 0}–{vivo.ospite ?? 0}</Text>
              : played
                ? <Text style={styles.score}>{match.score!.home}–{match.score!.away}</Text>
                : <Text style={styles.vs}>vs</Text>}
          </View>
          <Side team={match.away} />
        </View>
        <Text style={styles.when}>
          {/* "In corso · finita" era una contraddizione stampata sullo schermo */}
          {vivo && !vivo.finita
            ? `In corso · ${etichettaFase(vivo, match.kickoff)}`
            : vivo?.finita
              ? `Finita · ${longDate(match.kickoff)}`
              : longDate(match.kickoff)}
        </Text>
      </View>

      {!played && !vivo && match.kickoff ? (
        <View style={[gutter, { marginTop: space.lg }]}><Countdown kickoff={match.kickoff} /></View>
      ) : null}

      {/* i biglietti solo finche servono: a partita giocata sono un invito a
          comprare per una gara che non esiste piu */}
      {match.ticketUrl && !played ? (
        <View style={[gutter, { marginTop: space.xl }]}>
          <Button label="Acquista i biglietti" icon="ticket" onPress={() => Linking.openURL(match.ticketUrl!)} />
        </View>
      ) : null}

      <View style={[gutter, { marginTop: space.xl }]}>
        <Segmented
          value={view}
          onChange={setView}
          items={[
            // la cronaca per prima: e quello che si cerca aprendo una partita,
            // durante e dopo. La formazione la si guarda una volta, prima
            { key: 'eventi' as Tab, label: 'Cronaca' },
            { key: 'formazione' as Tab, label: 'Formazione' },
            // prima della partita si pronostica, dopo si danno i voti:
            // la stessa casella cambia mestiere al fischio finale
            { key: 'gioco' as Tab, label: played ? 'Pagelle' : 'Pronostico' },
            { key: 'dati' as Tab, label: 'Dati' },
          ]}
        />
      </View>

      {view === 'gioco' ? (
        <>
          <GroupLabel>{played ? 'Le pagelle della Curva' : 'Il pronostico'}</GroupLabel>
          <View style={gutter}>
            {played ? (
              <Pagelle
                matchId={match.id}
                /*
                 * Si vota chi e sceso in campo, non chi pensavamo giocasse.
                 *
                 * `lineup` porta l'undici ufficiale quando la fonte lo ha
                 * pubblicato; altrimenti ripiega su quello della partita
                 * precedente, che per le pagelle e un dato sbagliato: si
                 * finirebbe per dare un voto a chi era in tribuna. Quando la
                 * fonte manca lo si dice sotto, invece di far votare al buio.
                 */
                players={lineup.slots.map((sl) => sl.player).filter((pl): pl is NonNullable<typeof pl> => !!pl)}
              />
            ) : (
              <Pronostico match={match} />
            )}
          </View>
          <GroupNote>
            {!played
              ? 'Il pronostico resta su questo dispositivo. Con gli account veri entra in una classifica vera.'
              : lineup.fonte === 'ufficiale'
                ? 'Questo è l’undici sceso in campo. I voti fanno una media sola per tutti, e il giorno dopo le pagelle della Curva finiscono in home.'
                : `Attenzione: la formazione ufficiale di questa partita non è ancora arrivata, quindi qui c’è ${lineup.fonte === 'ultima' ? 'l’undici della partita precedente' : 'una formazione costruita dalla rosa'}. I voti valgono lo stesso, ma controlla i nomi prima.`}
          </GroupNote>
        </>
      ) : null}

      {view === 'formazione' ? (
        <>
          <GroupLabel>
            {lineup.fonte === 'ufficiale' ? 'Formazione ufficiale'
              : lineup.fonte === 'ultima' ? 'Così ha giocato l\'ultima volta'
              : 'Formazione probabile'}
          </GroupLabel>
          <View style={gutter}>
            <Lineup
              slots={lineup.slots}
              formation={lineup.formation}
              homeCrest={match.home.crest}
              awayCrest={match.away.crest}
              homeName={match.home.shortName}
              awayName={match.away.shortName}
              foggiaHome={match.foggiaHome}
            />
          </View>
          <GroupLabel>Panchina</GroupLabel>
          <View style={[styles.bench, gutter]}>
            {lineup.bench.map((p) => (
              <View key={p.id} style={styles.benchItem}>
                <Avatar uri={p.photo} name={p.name} size={40} />
                <Text style={styles.benchNum}>{p.number ?? '–'}</Text>
                <Text style={styles.benchName} numberOfLines={1}>{p.shortName}</Text>
              </View>
            ))}
          </View>
          <GroupNote>
            {lineup.fonte === 'ufficiale'
              ? 'Undici sceso in campo, da API-Football. La disposizione è la nostra: il modulo per la Serie C non lo pubblica nessuno.'
              : lineup.fonte === 'ultima'
                ? `Questo è l'undici sceso in campo il ${lineup.dataUltima ? shortDate(lineup.dataUltima) : 'match precedente'}. Le formazioni ufficiali escono circa un'ora prima del fischio: quando esce, questa si aggiorna da sola.`
                : 'Nessuna partita in archivio: questa formazione è costruita dalla rosa e va letta come una supposizione.'}
          </GroupNote>
        </>
      ) : null}

      {view === 'eventi' ? (
        cronaca.length ? (
          <>
            <GroupLabel>Cronaca</GroupLabel>
            <View style={gutter}>
              {cronaca.map((e, i) => (
                <RigaEvento
                  key={`${e.minuto}-${e.testo}-${i}`}
                  inCasa={e.inCasa}
                  minuto={`${e.minuto}'`}
                  testo={e.testo}
                  icona={e.icona}
                />
              ))}
            </View>
          </>
        ) : golVivo.length ? (
          <>
            <GroupLabel>Cronaca</GroupLabel>
            <View style={gutter}>
              {golVivo.map((g, i) => (
                <RigaEvento
                  key={`${g.minuto}-${i}`}
                  inCasa={match.foggiaHome ? g.nostro : !g.nostro}
                  minuto={g.minuto ? `${g.fonte === 'stimato' ? '~' : ''}${g.minuto}'` : '–'}
                  testo={g.chi ?? `${g.casa ?? 0}–${g.ospiti ?? 0}`}
                />
              ))}
            </View>
            {golVivo.some((g) => !g.chi) ? (
              <GroupNote>
                Il nome di chi ha segnato compare appena la fonte lo pubblica, di solito entro
                pochi minuti dal gol.
              </GroupNote>
            ) : null}
          </>
        ) : (
          <Empty text={vivo && !vivo.finita
            ? 'Ancora nessun gol in questa partita.'
            : played || vivo?.finita
              ? 'I marcatori compaiono quando la fonte pubblica il tabellino, di solito entro qualche ora dalla fine.'
              : 'Nessun evento registrato per questa partita.'} />
        )
      ) : null}

      {view === 'dati' ? (
      <>
      <GroupLabel>Dati partita</GroupLabel>
      <View style={gutter}>
        <ListGroup>
          <ListRow right={<Text style={styles.value} numberOfLines={1}>{match.venue ?? '–'}</Text>}>
            <Text style={styles.key}>Stadio</Text>
          </ListRow>
          <ListRow right={
            <Text style={styles.value}>
              {match.attendance == null ? '–' : match.attendance === 0 ? 'a porte chiuse' : thousands(match.attendance)}
            </Text>
          }>
            <Text style={styles.key}>Spettatori</Text>
          </ListRow>
          <ListRow right={<Text style={styles.value}>{match.referee ?? '–'}</Text>}>
            <Text style={styles.key}>Arbitro</Text>
          </ListRow>
          <ListRow right={<Text style={styles.value}>{match.competition}</Text>}>
            <Text style={styles.key}>Competizione</Text>
          </ListRow>
        </ListGroup>
      </View>
      </>
      ) : null}

      {h2h.length ? (
        <>
          <GroupLabel>Precedenti in stagione</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              {h2h.map((m) => (
                <ListRow key={m.id} height={44}>
                  <Text style={styles.key} numberOfLines={1}>
                    {m.home.shortName} {m.score?.home}–{m.score?.away} {m.away.shortName}
                  </Text>
                </ListRow>
              ))}
            </ListGroup>
          </View>
        </>
      ) : null}

      {match.reportUrl ? (
        <View style={[gutter, { marginTop: space.xl }]}>
          <Button label="Referto della partita" tone="plain" onPress={() => Linking.openURL(match.reportUrl!)} />
        </View>
      ) : null}
    </Screen>
  );
}

function Side({ team }: { team: { crest: string | null; shortName: string } }) {
  return (
    <View style={styles.side_}>
      <Crest uri={team.crest} name={team.shortName} size={62} />
      <Text style={styles.teamName} numberOfLines={2}>{team.shortName}</Text>
    </View>
  );
}

/**
 * Una riga della cronaca, con la bolla dalla parte della squadra che ha segnato.
 *
 * Prima la bolla stava sempre nella prima colonna e cambiava solo
 * l'allineamento interno: un gol degli avversari finiva comunque a sinistra
 * della linea del minuto, cioe dalla parte del Foggia. In Foggia-Salernitana
 * si leggevano due gol nostri quando era 1-1.
 *
 * `inCasa` e il lato della scheda, non "il Foggia": la colonna di sinistra e
 * sempre la squadra di casa di quella partita, come il punteggio sopra.
 */
function RigaEvento({ inCasa, minuto, testo, icona = 'football' }: {
  inCasa: boolean; minuto: string; testo: string;
  icona?: keyof typeof Ionicons.glyphMap;
}) {
  const bolla = (
    <View style={styles.eventBubble}>
      <Ionicons
        name={icona}
        size={13}
        color={icona === 'close-circle' ? '#E5343E' : icona === 'square' ? '#E8C547' : colors.text}
      />
      <Text style={styles.eventName} numberOfLines={1}>{testo}</Text>
    </View>
  );
  return (
    <View style={styles.event}>
      <View style={styles.eventSide}>{inCasa ? bolla : null}</View>
      <View style={styles.eventLine}>
        <View style={styles.eventDot} />
        <Text style={styles.eventMinute}>{minuto}</Text>
      </View>
      <View style={[styles.eventSide, styles.eventSideRight]}>{inCasa ? null : bolla}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  scoreboard: { alignItems: 'center', gap: space.lg, marginTop: space.lg },
  teams: { flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch' },
  side_: { flex: 1, alignItems: 'center', gap: space.sm },
  teamName: { ...type.headline, color: colors.text, textAlign: 'center' },
  centre: { width: 110, alignItems: 'center', paddingTop: space.md },
  score: { ...type.score, color: colors.text },
  vs: { ...type.title1, color: colors.textFaint },
  when: { ...type.subhead, color: colors.textDim },

  minute: { ...type.footnoteBold, color: colors.accentBright, width: 36 },
  scorer: { ...type.subhead, color: colors.text, flex: 1 },
  side: { ...type.caption, color: colors.textFaint },

  bench: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  benchItem: { alignItems: 'center', gap: 2, width: 58 },
  benchNum: { ...type.captionBold, color: colors.accentBright },
  benchName: { ...type.caption, color: colors.textDim, textAlign: 'center' },

  event: { flexDirection: 'row', alignItems: 'center', minHeight: 46 },
  eventSide: { flex: 1, alignItems: 'flex-end' },
  eventSideRight: { alignItems: 'flex-start' },
  eventBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: 8, maxWidth: 170,
  },
  eventName: { ...type.footnote, color: colors.text, flexShrink: 1 },
  eventLine: { width: 58, alignItems: 'center', gap: 2 },
  eventDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  eventMinute: { ...type.caption, color: colors.textFaint },

  key: { ...type.subhead, color: colors.text },
  value: { ...type.subhead, color: colors.textDim, maxWidth: 190, textAlign: 'right' },
});
