import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '@satanelli/core';

import { Crest } from './Crest';
import { Premi } from './anima';
import { SoloConAccount } from './SoloConAccount';
import { colors, radius, space, type } from '../theme/tokens';
import { salvaPronostico, usePronostico } from '../lib/pronostici';
import { useOspite } from '../lib/ospite';

/**
 * Il pronostico della partita.
 *
 * COM'ERA, E PERCHE NON ANDAVA
 *
 * C'erano due file di quadratini da trenta punti con i numeri da 0 a 4, e ogni
 * tocco salvava. Tre problemi in uno: i quadratini sono piu piccoli del
 * polpastrello, non si capiva che il tocco aveva gia salvato, e chi voleva
 * pensarci un attimo aveva gia giocato.
 *
 * COM'E ADESSO
 *
 * Due contatori grandi, meno e piu, e un tasto "Salva il pronostico" che dice
 * cosa stai per fare. Finche non lo premi non e giocato niente. Dopo, il tasto
 * diventa "Cambia il pronostico" e si puo correggere fino al fischio d'inizio.
 *
 * E i punti scritti in chiaro, con i numeri veri: dieci per averlo messo,
 * cinquanta se indovini come finisce, cento se prendi il risultato esatto.
 */

const MAX = 9;

export function Pronostico({ match }: { match: Match }) {
  const ospite = useOspite();
  const { mio, caricato, conAccount } = usePronostico(match.id);

  const [casa, setCasa] = useState(0);
  const [ospiti, setOspiti] = useState(0);
  const [modifica, setModifica] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);

  // quando il pronostico arriva dal server, i contatori partono da li
  useEffect(() => {
    if (mio) { setCasa(mio.casa); setOspiti(mio.ospiti); }
  }, [mio?.casa, mio?.ospiti]);

  const chiuso = cominciata(match);
  const cambiato = !mio || mio.casa !== casa || mio.ospiti !== ospiti;
  const apertoInModifica = !mio || modifica;

  async function salva() {
    if (inCorso) return;
    setInCorso(true);
    setEsito(null);
    const r = await salvaPronostico(match.id, casa, ospiti);
    setInCorso(false);
    setEsito({ ok: r.ok, testo: r.messaggio });
    if (r.ok) setModifica(false);
  }

  return (
    <View style={stili.wrap}>
      {ospite || !conAccount ? (
        <SoloConAccount cosa="Per giocare il pronostico e prendere punti serve un account. Guardare, no." />
      ) : null}

      <View style={stili.scheda}>
        <Text style={stili.titolo}>Il tuo pronostico</Text>
        <Text style={stili.spiega}>
          Scrivi come pensi che finisca. Vale finché non comincia la partita, e fino ad allora
          puoi cambiarlo quante volte vuoi.
        </Text>

        {!caricato ? (
          <View style={stili.attesa}><ActivityIndicator color={colors.accent} /></View>
        ) : (
          <>
            {/*
              * Nomi sopra, contatori sotto, su due righe distinte.
              * Con tutto in una riga sola il trattino andava tenuto giu a mano
              * con un margine fisso, e bastava uno stemma mancante o un nome su
              * due righe per vederlo fuori posto.
              */}
            <View style={stili.tabellone}>
              <Squadra squadra={match.home} />
              <View style={stili.mezzo} />
              <Squadra squadra={match.away} />
            </View>

            <View style={stili.contatori}>
              <Contatore
                nome={match.home.shortName}
                valore={casa}
                attivo={apertoInModifica && !chiuso && conAccount}
                onCambia={setCasa}
              />
              <View style={stili.mezzo} />
              <Contatore
                nome={match.away.shortName}
                valore={ospiti}
                attivo={apertoInModifica && !chiuso && conAccount}
                onCambia={setOspiti}
              />
            </View>

            {chiuso ? (
              <View style={stili.stato}>
                <Ionicons name="lock-closed" size={16} color={colors.textFaint} />
                <Text style={stili.statoTesto}>
                  {mio
                    ? `La partita è cominciata. Resta il tuo ${mio.casa}–${mio.ospiti}.`
                    : 'La partita è cominciata: i pronostici sono chiusi.'}
                </Text>
              </View>
            ) : !conAccount ? null : apertoInModifica ? (
              <Premi
                onPress={salva}
                disabled={inCorso || (!cambiato && Boolean(mio))}
                etichetta="Salva il pronostico"
                style={[stili.tasto, (inCorso || (!cambiato && Boolean(mio))) && stili.tastoSpento]}
              >
                <Ionicons name="checkmark" size={19} color={colors.onAccent} />
                <Text style={stili.tastoTesto}>
                  {inCorso ? 'Sto salvando…' : mio ? 'Salva la modifica' : 'Salva il pronostico'}
                </Text>
              </Premi>
            ) : (
              <>
                <View style={stili.fatto}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.win} />
                  <Text style={stili.fattoTesto}>
                    Hai giocato {mio!.casa}–{mio!.ospiti}. È salvato.
                  </Text>
                </View>
                <Premi
                  onPress={() => { setModifica(true); setEsito(null); }}
                  etichetta="Cambia il pronostico"
                  style={[stili.tasto, stili.tastoPiano]}
                >
                  <Ionicons name="create-outline" size={18} color={colors.accentBright} />
                  <Text style={[stili.tastoTesto, { color: colors.accentBright }]}>Cambia il pronostico</Text>
                </Premi>
              </>
            )}

            {esito ? (
              <View style={[stili.messaggio, !esito.ok && stili.messaggioMale]}>
                <Ionicons
                  name={esito.ok ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={esito.ok ? colors.win : colors.accentBright}
                />
                <Text style={[stili.messaggioTesto, !esito.ok && { color: colors.accentBright }]}>
                  {esito.testo}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={stili.punti}>
        <Text style={stili.puntiTitolo}>Quanto vale</Text>
        <Riga numero="10" testo="per aver messo il pronostico, comunque vada" />
        <Riga numero="50" testo="se indovini come finisce: vittoria, pareggio o sconfitta" />
        <Riga numero="100" testo="se prendi il risultato esatto" />
        <Text style={stili.nota}>
          Nessuna scommessa e nessun premio in denaro: i punti servono solo per la classifica
          fra tifosi.
        </Text>
      </View>
    </View>
  );
}

/** Vero quando il fischio d'inizio e passato: da li in poi non si tocca piu. */
function cominciata(match: Match): boolean {
  if (match.status && match.status !== 'scheduled') return true;
  const t = match.kickoff ? Date.parse(match.kickoff) : NaN;
  return Number.isFinite(t) ? Date.now() >= t : false;
}

function Squadra({ squadra }: { squadra: Match['home'] }) {
  return (
    <View style={stili.lato}>
      <Crest uri={squadra.crest} name={squadra.shortName} size={40} />
      <Text style={stili.squadra} numberOfLines={1}>{squadra.shortName}</Text>
    </View>
  );
}

function Contatore({ nome, valore, attivo, onCambia }: {
  nome: string; valore: number; attivo: boolean; onCambia: (v: number) => void;
}) {
  return (
    <View style={stili.lato}>
      <View style={stili.contatore}>
        <Premi
          onPress={() => onCambia(Math.max(0, valore - 1))}
          disabled={!attivo || valore === 0}
          etichetta={`Un gol in meno per ${nome}`}
          style={[stili.passo, (!attivo || valore === 0) && stili.passoSpento]}
        >
          <Ionicons name="remove" size={22} color={colors.text} />
        </Premi>

        <Text style={stili.numero}>{valore}</Text>

        <Premi
          onPress={() => onCambia(Math.min(MAX, valore + 1))}
          disabled={!attivo || valore === MAX}
          etichetta={`Un gol in più per ${nome}`}
          style={[stili.passo, (!attivo || valore === MAX) && stili.passoSpento]}
        >
          <Ionicons name="add" size={22} color={colors.text} />
        </Premi>
      </View>
    </View>
  );
}

function Riga({ numero, testo }: { numero: string; testo: string }) {
  return (
    <View style={stili.rigaPunti}>
      <Text style={stili.rigaNumero}>{numero}</Text>
      <Text style={stili.rigaTesto}>{testo}</Text>
    </View>
  );
}

const stili = StyleSheet.create({
  wrap: { gap: space.lg },

  scheda: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: space.lg, gap: space.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)',
  },
  titolo: { ...type.title3, color: colors.text },
  spiega: { ...type.subhead, color: colors.textDim, lineHeight: 21 },
  attesa: { paddingVertical: space.xl, alignItems: 'center' },

  tabellone: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.sm },
  contatori: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mezzo: { width: 22 },
  lato: { flex: 1, alignItems: 'center', gap: 6 },
  squadra: { ...type.subheadBold, color: colors.text },

  contatore: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // quarantaquattro punti: la misura minima perche un dito ci prenda sempre
  passo: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center',
  },
  passoSpento: { opacity: 0.3 },
  numero: { ...type.score, fontSize: 34, lineHeight: 40, color: colors.text, minWidth: 34, textAlign: 'center' },

  tasto: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 16,
    marginTop: space.sm,
  },
  tastoPiano: { backgroundColor: colors.surfaceHi },
  tastoSpento: { opacity: 0.45 },
  tastoTesto: { ...type.headline, color: colors.onAccent },

  fatto: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: 'rgba(48,209,88,0.12)', borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.md, marginTop: space.sm,
  },
  fattoTesto: { ...type.subheadBold, color: colors.text, flex: 1 },

  stato: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surfaceHi, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.md, marginTop: space.sm,
  },
  statoTesto: { ...type.footnote, color: colors.textDim, flex: 1, lineHeight: 18 },

  messaggio: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    backgroundColor: 'rgba(48,209,88,0.10)', borderRadius: radius.md,
  },
  messaggioMale: { backgroundColor: colors.accentSoft },
  messaggioTesto: { ...type.footnote, color: colors.text, flex: 1, lineHeight: 18 },

  punti: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: space.lg, gap: space.md,
  },
  puntiTitolo: { ...type.headline, color: colors.text },
  rigaPunti: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rigaNumero: {
    ...type.numberSm, color: colors.accentBright, minWidth: 38, textAlign: 'right',
  },
  rigaTesto: { ...type.subhead, color: colors.textDim, flex: 1, lineHeight: 20 },
  nota: { ...type.caption, color: colors.textFaint, lineHeight: 17, marginTop: 2 },
});
