import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, LargeTitle, Empty, GroupLabel, GroupNote, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { Crest } from '../../components/Crest';
import { Premi } from '../../components/anima';
import { colors, radius, space, type } from '../../theme/tokens';
import { useRuolo } from '../../lib/moderazione';
import { prossima, squad, nextMatch } from '../../lib/data';
import { useDati } from '../../lib/bundle-remoto';
import { etichettaFase } from '../../lib/live-core';
import {
  annullaGol, cambiaFase, chiudiPartita, correggiPunteggio, impostaRecupero, segnaGol,
  spegniTabellone, useTabellone, type RigaTabellone,
} from '../../lib/tabellone';
import { discordanza, elencoMarcatori, latoDi, minutoOra, type Marcatore } from '../../lib/tabellone-core';

/**
 * Il tabellone a mano.
 *
 * PERCHE ESISTE
 *
 * Le fonti dal vivo arrivano in ritardo, e non dipende da noi: il 15 settembre
 * i gol si vedevano con qualche minuto e le formazioni con cinquanta. Chi e
 * allo stadio o davanti alla partita lo sa prima di chiunque, e da qui puo
 * scriverlo per tutti: il punteggio arriva su ogni telefono nello stesso
 * istante, perche l'app legge quella riga con Realtime.
 *
 * COM'E FATTA
 *
 * Due tasti grandi, uno per parte del campo, e sotto la cronaca con accanto a
 * ogni gol il tasto per annullarlo. Si usa con una mano sola, guardando la
 * partita e non lo schermo: per questo i tasti sono due e non otto, e per
 * questo il minuto lo mette lei da sola.
 *
 * Quando il tabellone e acceso comanda chi lo tiene: il guardiano continua a
 * leggere le fonti e a scrivere minuto, cartellini e cambi, ma il punteggio e
 * i gol restano quelli scritti qui. Cosi un gol annullato resta annullato,
 * invece di tornare da solo due minuti dopo.
 *
 * MA SOLO FINCHE SERVE.
 *
 * Appena le fonti arrivano allo stesso punteggio riprendono loro, da sole.
 * Senza questa regola, uno che segna 1-0 e poi si distrae lascerebbe il
 * tabellone fermo a 1-0 per tutta la partita, e la chiusura pagherebbe i
 * pronostici su quel risultato. Il lato dove un gol e stato annullato resta a
 * mano finche anche le fonti lo tolgono: e l'unico modo perche non torni.
 */
export default function TabelloneAMano() {
  const versione = useDati();
  const ruolo = useRuolo();
  const gutter = useGutter();

  const match = nextMatch();
  const partita = prossima?.eventId ? String(prossima.eventId) : null;
  const { riga, caricato, ricarica } = useTabellone(partita);

  const [chiSegna, setChiSegna] = useState<'noi' | 'loro' | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const foggiaInCasa = /foggia/i.test(prossima?.home ?? match?.home.name ?? '');

  /*
   * I marcatori possibili: prima chi e in campo oggi.
   *
   * `versione` sta nelle dipendenze perche la rosa e la formazione arrivano
   * dal bundle, e senza questo l'elenco resterebbe quello del primo disegno
   * anche dopo un aggiornamento dei dati.
   */
  const nostri = useMemo(() => {
    const colonna = foggiaInCasa ? riga?.formazione?.casa : riga?.formazione?.ospiti;
    return elencoMarcatori(squad, colonna?.giocatori ?? null);
  }, [riga?.formazione, foggiaInCasa, versione]);

  const loro = useMemo(() => {
    const colonna = foggiaInCasa ? riga?.formazione?.ospiti : riga?.formazione?.casa;
    return elencoMarcatori([], colonna?.giocatori ?? null);
  }, [riga?.formazione, foggiaInCasa, versione]);

  if (ruolo !== 'admin') {
    return (
      <Screen>
        <BackBar label="Pannello" />
        <Empty text="Il tabellone a mano è solo per chi amministra." />
      </Screen>
    );
  }

  if (!partita) {
    return (
      <Screen>
        <BackBar label="Pannello" />
        <Empty text="Nessuna partita in programma: non c’è niente da segnare." />
      </Screen>
    );
  }

  /*
   * Dopo ogni comando si rilegge la riga.
   *
   * Realtime la porta da solo, e di solito arriva prima; ma qui si sta
   * scrivendo il risultato per tutti, e un tasto che sembra non aver fatto
   * niente -- perche il canale e caduto -- si preme una seconda volta.
   */
  const fai = async (cosa: () => Promise<{ ok: boolean; messaggio: string }>) => {
    setErrore(null);
    setInCorso(true);
    try {
      const esito = await cosa();
      if (!esito.ok) setErrore(esito.messaggio);
      await ricarica();
    } finally {
      setInCorso(false);
    }
  };

  const minuto = minutoOra(riga?.minuto);

  const segna = (marcatore: Marcatore | null, nostro: boolean) => {
    setChiSegna(null);
    void fai(() => segnaGol(partita, latoDi(nostro, foggiaInCasa), nostro, marcatore?.nome ?? null, minuto));
  };

  const togli = (voce: { id?: string | null; minuto?: string | null; nostro?: boolean; chi?: string | null }) => {
    Alert.alert(
      'Annullare questo gol?',
      `${voce.minuto ? `${voce.minuto}' ` : ''}${voce.chi ?? ''}\n\nIl punteggio torna indietro su tutti i telefoni, e a chi ha le notifiche arriva “Gol annullato”.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Annulla il gol',
          style: 'destructive',
          onPress: () => void fai(() => annullaGol(
            partita,
            voce.id ?? null,
            latoDi(Boolean(voce.nostro), foggiaInCasa),
            minutoOra(voce.minuto),
          )),
        },
      ],
    );
  };

  /*
   * Spegnere con un gol annullato in sospeso e l'unico modo di farlo tornare.
   *
   * Le fonti un gol annullato continuano a contarlo per minuti: restituire il
   * comando mentre lo contano ancora vuol dire rimetterlo sul tabellone, e far
   * suonare di nuovo i telefoni.
   */
  const tornaAutomatico = () => {
    const spegni = () => void fai(() => spegniTabellone(partita));
    if (!riga?.annullati.length) { spegni(); return; }
    Alert.alert(
      'Tornare all’automatico?',
      'Hai annullato un gol. Se le fonti lo contano ancora, tornerà sul tabellone e i telefoni suoneranno di nuovo.',
      [
        { text: 'No, resto io' },
        { text: 'Torna all’automatico', style: 'destructive', onPress: spegni },
      ],
    );
  };

  const chiudi = () => {
    Alert.alert(
      'Chiudere la partita?',
      `Il risultato ${riga?.casa ?? 0}-${riga?.ospiti ?? 0} diventa quello definitivo: paga i pronostici e non si cambia più.`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Chiudi', style: 'destructive', onPress: () => void fai(() => chiudiPartita(partita)) },
      ],
    );
  };

  const casa = riga?.casa ?? 0;
  const ospiti = riga?.ospiti ?? 0;
  const avviso = riga ? discordanza({ casa: riga.casa, ospiti: riga.ospiti }, riga.fonti) : null;
  const vivo = riga?.stato && ['1H', '2H', 'ET'].includes(riga.stato);

  return (
    <Screen>
      <BackBar label="Pannello" />
      <LargeTitle
        title="Tabellone"
        subtitle={prossima?.label ?? 'La partita di oggi'}
      />

      {/* ------------------------------------------------------ il punteggio */}
      <View style={[gutter, stili.tabellone]}>
        <Crest uri={match?.home.crest ?? null} name={match?.home.shortName ?? 'Casa'} size={34} />
        <View style={stili.centro}>
          <Text style={stili.numeri}>{casa} : {ospiti}</Text>
          <Text style={stili.fase}>
            {riga?.finitaIl
              ? 'partita chiusa'
              : riga?.stato
                ? etichettaFase({
                  stato: riga.stato, fase: riga.stato, casa: riga.casa, ospite: riga.ospiti,
                  minuto: riga.minuto, finita: false, aggiornato: Date.now(),
                  recupero: riga.recupero, aMano: riga.manuale,
                }, prossima?.kickoff)
                : caricato ? 'non è ancora cominciata' : 'sto leggendo…'}
          </Text>
        </View>
        <Crest uri={match?.away.crest ?? null} name={match?.away.shortName ?? 'Ospiti'} size={34} />
      </View>

      <View style={[gutter, stili.riga]}>
        <View style={[stili.pastiglia, riga?.manuale ? stili.acceso : stili.spento]}>
          <Ionicons
            name={riga?.manuale ? 'hand-left' : 'cloud-outline'}
            size={15}
            color={riga?.manuale ? colors.onAccent : colors.textDim}
          />
          <Text style={[stili.pastigliaTesto, riga?.manuale && { color: colors.onAccent }]}>
            {riga?.manuale ? 'Comandi tu' : 'Automatico'}
          </Text>
        </View>
        {riga?.manuale ? (
          <Premi onPress={tornaAutomatico} etichetta="Torna all'automatico">
            <Text style={stili.legame}>Torna all’automatico</Text>
          </Premi>
        ) : null}
      </View>

      <Text style={[gutter, stili.spiega]}>
        {riga?.manuale
          ? 'Il punteggio è quello che scrivi tu. Appena le fonti arrivano allo stesso risultato riprendono loro, da sole: non devi ricordarti di spegnere niente.'
          : 'Comanda il guardiano. Segna un gol e da quel momento comandi tu.'}
      </Text>

      {avviso ? (
        <View style={[gutter, stili.avviso]}>
          <Ionicons name="alert-circle" size={17} color={colors.zonePlayout} />
          <Text style={stili.avvisoTesto}>{avviso}. Controlla se ti è sfuggito un gol.</Text>
        </View>
      ) : null}

      {errore ? <Text style={[gutter, stili.errore]}>{errore}</Text> : null}

      {/* ----------------------------------------------------------- i gol */}
      <GroupLabel>Segna un gol</GroupLabel>
      <View style={[gutter, stili.tasti]}>
        <Premi
          onPress={() => setChiSegna('noi')}
          disabled={inCorso || Boolean(riga?.finitaIl)}
          contenitore={{ flex: 1 }}
          style={[stili.tastone, stili.nostro]}
          etichetta="Gol del Foggia"
        >
          <Ionicons name="football" size={26} color={colors.onAccent} />
          <Text style={stili.tastoneTesto}>GOL FOGGIA</Text>
          <Text style={stili.tastoneSotto}>scegli chi ha segnato</Text>
        </Premi>
        <Premi
          onPress={() => (loro.length ? setChiSegna('loro') : segna(null, false))}
          disabled={inCorso || Boolean(riga?.finitaIl)}
          contenitore={{ flex: 1 }}
          style={[stili.tastone, stili.loro]}
          etichetta="Gol dell'avversario"
        >
          <Ionicons name="football-outline" size={26} color={colors.text} />
          <Text style={[stili.tastoneTesto, { color: colors.text }]}>Gol loro</Text>
          <Text style={stili.tastoneSotto}>{loro.length ? 'scegli chi ha segnato' : 'senza marcatore'}</Text>
        </Premi>
      </View>
      <GroupNote>
        Il minuto lo mette da solo: {minuto ? `adesso siamo al ${minuto}’` : 'appena la partita comincia'}.
      </GroupNote>

      {/* ------------------------------------------------------- il recupero */}
      <GroupLabel>Recupero</GroupLabel>
      <View style={[gutter, stili.minuti]}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <Premi
            key={n}
            onPress={() => void fai(() => impostaRecupero(partita, n))}
            disabled={inCorso}
            style={[stili.minuto, riga?.recupero === n && stili.minutoScelto]}
            etichetta={`${n} minuti di recupero`}
          >
            <Text style={[stili.minutoTesto, riga?.recupero === n && { color: colors.onAccent }]}>+{n}</Text>
          </Premi>
        ))}
        <Premi
          onPress={() => void fai(() => impostaRecupero(partita, null))}
          disabled={inCorso}
          style={stili.minuto}
          etichetta="Togli il recupero"
        >
          <Ionicons name="close" size={18} color={colors.textDim} />
        </Premi>
      </View>
      <GroupNote>
        {vivo
          ? 'Compare sotto il punteggio, accanto al minuto, su tutti i telefoni.'
          : 'Si scrive quando il quarto uomo alza il cartello. Fuori dai tempi di gioco sparisce da solo.'}
      </GroupNote>

      {/* ---------------------------------------------------------- la fase */}
      <GroupLabel>Dove siamo</GroupLabel>
      <View style={[gutter, stili.minuti]}>
        {([['1H', '1° tempo'], ['HT', 'Intervallo'], ['2H', '2° tempo']] as const).map(([k, etichetta]) => (
          <Premi
            key={k}
            onPress={() => void fai(() => cambiaFase(partita, k))}
            disabled={inCorso || Boolean(riga?.finitaIl)}
            style={[stili.fasePulsante, riga?.stato === k && stili.minutoScelto]}
            etichetta={etichetta}
          >
            <Text style={[stili.minutoTesto, riga?.stato === k && { color: colors.onAccent }]}>{etichetta}</Text>
          </Premi>
        ))}
      </View>
      <GroupNote>
        Serve quando le fonti sono indietro e l’app dice ancora “sta per cominciare”. Indietro non si
        torna: se le fonti sono già più avanti, vince quello che dicono loro.
      </GroupNote>

      {/* -------------------------------------------------------- la cronaca */}
      <GroupLabel>Cronaca</GroupLabel>
      <View style={gutter}>
        {!riga?.gol.length ? (
          <Text style={stili.vuoto}>Ancora nessun gol.</Text>
        ) : (
          riga.gol.map((g, i) => (
            <View key={`${g.id ?? i}`} style={stili.voce}>
              <Text style={stili.voceMinuto}>{g.minuto ? `${g.minuto}’` : '–'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={stili.voceNome}>{g.chi ?? (g.nostro ? 'Gol del Foggia' : 'Gol loro')}</Text>
                <Text style={stili.voceSotto}>
                  {g.nostro ? 'Foggia' : (prossima?.away ?? 'avversari')}
                  {g.fonte === 'admin' ? ' · scritto da te' : ' · dalle fonti'}
                  {g.casa != null ? ` · ${g.casa}-${g.ospiti}` : ''}
                </Text>
              </View>
              <Premi
                onPress={() => togli(g)}
                disabled={inCorso || Boolean(riga.finitaIl)}
                scala={1}
                style={stili.tastoIcona}
                etichetta="Annulla questo gol"
              >
                <Ionicons name="close-circle" size={24} color={colors.accentBright} />
              </Premi>
            </View>
          ))
        )}

        {riga?.annullati.length ? (
          <>
            <Text style={stili.sottotitolo}>Annullati</Text>
            {riga.annullati.map((a, i) => (
              <View key={`${a.id ?? i}`} style={[stili.voce, { opacity: 0.6 }]}>
                <Text style={stili.voceMinuto}>{a.minuto ? `${a.minuto}’` : '–'}</Text>
                <Text style={[stili.voceNome, stili.sbarrato]}>
                  {a.chi ?? (a.nostro ? 'Gol del Foggia' : 'Gol loro')}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </View>

      {/* ------------------------------------------------------- correzioni */}
      <GroupLabel>Se il punteggio è sbagliato</GroupLabel>
      <View style={[gutter, stili.minuti]}>
        {([['casa', -1], ['casa', 1], ['ospiti', -1], ['ospiti', 1]] as const).map(([lato, quanto]) => (
          <Premi
            key={`${lato}${quanto}`}
            onPress={() => void fai(() => correggiPunteggio(
              partita,
              Math.max(casa + (lato === 'casa' ? quanto : 0), 0),
              Math.max(ospiti + (lato === 'ospiti' ? quanto : 0), 0),
            ))}
            disabled={inCorso || Boolean(riga?.finitaIl)}
            style={stili.fasePulsante}
            etichetta={`${quanto > 0 ? 'Aggiungi' : 'Togli'} un gol ${lato === 'casa' ? 'in casa' : 'fuori casa'}`}
          >
            <Text style={stili.minutoTesto}>
              {quanto > 0 ? '+1' : '−1'} {lato === 'casa' ? (match?.home.shortName ?? 'casa') : (match?.away.shortName ?? 'ospiti')}
            </Text>
          </Premi>
        ))}
      </View>
      <GroupNote>
        Cambia solo il numero, senza toccare i marcatori già scritti. Un −1 dura finché le fonti non
        dicono un numero più alto: per togliere un gol che le fonti contano ancora, usa la croce
        nella cronaca.
      </GroupNote>

      {/* ----------------------------------------------------------- la fine */}
      <GroupLabel>Fine partita</GroupLabel>
      <View style={gutter}>
        <Premi
          onPress={chiudi}
          disabled={inCorso || Boolean(riga?.finitaIl)}
          style={[stili.tastone, stili.chiudi]}
          etichetta="Chiudi la partita"
        >
          <Text style={[stili.tastoneTesto, { color: colors.text }]}>
            {riga?.finitaIl ? 'Già chiusa' : `Triplice fischio · ${casa}-${ospiti}`}
          </Text>
          <Text style={stili.tastoneSotto}>paga i pronostici, non si torna indietro</Text>
        </Premi>
      </View>

      <GroupNote>
        Quello che scrivi qui vale finché le fonti non ti raggiungono: quando vedono lo stesso
        punteggio riprendono loro, e se nel frattempo ti distrai il gol degli avversari entra
        comunque. Il lato del campo dove hai annullato un gol resta tuo finché anche le fonti lo
        tolgono. Minuto, cartellini e cambi continua a scriverli il guardiano in ogni caso.
      </GroupNote>

      <ElencoMarcatori
        aperto={chiSegna !== null}
        titolo={chiSegna === 'noi' ? 'Chi ha segnato?' : `Chi ha segnato per ${prossima?.away ?? 'loro'}?`}
        elenco={chiSegna === 'noi' ? nostri : loro}
        onScegli={(m) => segna(m, chiSegna === 'noi')}
        onChiudi={() => setChiSegna(null)}
      />
    </Screen>
  );
}

/**
 * L'elenco dei marcatori.
 *
 * A tutto schermo, con i nomi grandi: si preme mentre si guarda la partita,
 * spesso in piedi. "Non lo so" sta in cima insieme ai titolari, perche il gol
 * va segnato subito e il nome puo arrivare dopo -- si aggiunge annullando e
 * rifacendo, oppure lo scrivono le fonti.
 */
function ElencoMarcatori({ aperto, titolo, elenco, onScegli, onChiudi }: {
  aperto: boolean;
  titolo: string;
  elenco: Marcatore[];
  onScegli: (m: Marcatore | null) => void;
  onChiudi: () => void;
}) {
  const gutter = useGutter();
  return (
    <Modal visible={aperto} animationType="slide" transparent onRequestClose={onChiudi}>
      <View style={stili.fondale}>
        <View style={stili.foglio}>
          <View style={[gutter, stili.testaFoglio]}>
            <Text style={stili.titoloFoglio}>{titolo}</Text>
            <Pressable onPress={onChiudi} hitSlop={12} accessibilityLabel="Chiudi">
              <Ionicons name="close" size={26} color={colors.textDim} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={[gutter, { paddingBottom: space.xxl, gap: space.sm }]}>
            <Premi onPress={() => onScegli(null)} style={[stili.nome, stili.nomeSenza]}>
              <Text style={stili.nomeTesto}>Non lo so ancora</Text>
              <Text style={stili.voceSotto}>il gol si vede subito, il nome può arrivare dopo</Text>
            </Premi>

            {elenco.map((m, i) => (
              <Premi key={`${m.id ?? m.nome}-${i}`} onPress={() => onScegli(m)} style={stili.nome}>
                <View style={stili.numeroMaglia}>
                  <Text style={stili.numeroTesto}>{m.numero ?? '–'}</Text>
                </View>
                <Text style={stili.nomeTesto}>{m.nome}</Text>
                {m.inCampo ? <Text style={stili.inCampo}>in campo</Text> : null}
              </Premi>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const stili = StyleSheet.create({
  tabellone: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  centro: { flex: 1, alignItems: 'center' },
  numeri: { ...type.title1, color: colors.text, fontVariant: ['tabular-nums'] },
  fase: { ...type.footnote, color: colors.textDim },

  riga: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
  pastiglia: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs,
    paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  acceso: { backgroundColor: colors.accent },
  spento: { backgroundColor: colors.surfaceHi },
  pastigliaTesto: { ...type.captionBold, color: colors.textDim },
  legame: { ...type.footnoteBold, color: colors.accentBright },

  avviso: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md,
  },
  avvisoTesto: { ...type.footnote, color: colors.textDim, flex: 1 },
  errore: { ...type.footnote, color: colors.accentBright, marginTop: space.sm },

  tasti: { flexDirection: 'row', gap: space.md },
  tastone: {
    borderRadius: radius.lg, paddingVertical: space.lg, paddingHorizontal: space.md,
    alignItems: 'center', gap: 2, minHeight: 96, justifyContent: 'center',
  },
  nostro: { backgroundColor: colors.accent },
  loro: { backgroundColor: colors.surfaceHi },
  chiudi: { backgroundColor: colors.surface, minHeight: 72 },
  tastoneTesto: { ...type.headline, color: colors.onAccent, textAlign: 'center' },
  tastoneSotto: { ...type.caption, color: colors.textFaint, textAlign: 'center' },

  minuti: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  minuto: {
    minWidth: 52, minHeight: 48, paddingHorizontal: space.md,
    borderRadius: radius.md, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  fasePulsante: {
    minHeight: 48, paddingHorizontal: space.lg,
    borderRadius: radius.md, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  minutoScelto: { backgroundColor: colors.accent },
  minutoTesto: { ...type.subheadBold, color: colors.text },

  spiega: { ...type.footnote, color: colors.textDim, marginTop: space.sm },
  vuoto: { ...type.subhead, color: colors.textDim, paddingVertical: space.md },
  sottotitolo: { ...type.captionBold, color: colors.textFaint, marginTop: space.md, marginBottom: space.xs },
  voce: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.sm,
  },
  voceMinuto: { ...type.subheadBold, color: colors.textDim, minWidth: 44, fontVariant: ['tabular-nums'] },
  voceNome: { ...type.headline, color: colors.text },
  voceSotto: { ...type.caption, color: colors.textFaint },
  sbarrato: { textDecorationLine: 'line-through', color: colors.textDim },
  tastoIcona: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  fondale: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  foglio: {
    backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingTop: space.lg, maxHeight: '86%',
  },
  testaFoglio: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: space.md,
  },
  titoloFoglio: { ...type.title3, color: colors.text },
  nome: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: space.md, minHeight: 56,
  },
  nomeSenza: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 0, paddingVertical: space.sm },
  nomeTesto: { ...type.headline, color: colors.text, flex: 1 },
  numeroMaglia: {
    width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  numeroTesto: { ...type.footnoteBold, color: colors.textDim },
  inCampo: { ...type.caption, color: colors.win },
});
