import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useGutter, Empty } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Avatar } from '../components/Avatar';
import { Crest } from '../components/Crest';
import { PallinoLive } from '../components/PallinoLive';
import { SoloConAccount } from '../components/SoloConAccount';
import { AzioniContenuto } from '../components/AzioniContenuto';
import { Premi } from '../components/anima';
import { colors, radius, space, type } from '../theme/tokens';
import { nextMatch } from '../lib/data';
import { useOspite } from '../lib/ospite';
import { useLive, liveDi } from '../lib/live';
import { etichettaFase } from '../lib/live-core';
import { useSala, manda, cancella, salaAperta, LIMITE } from '../lib/sala';
import { ioSono } from '../lib/trasferte';
import { controlla, spiegazione } from '../lib/filtro-core.ts';

/**
 * La chat della partita.
 *
 * In testa il punteggio dal vivo, sotto quello che si dicono i tifosi. Non e
 * una chat generica con sopra un risultato: e il risultato che detta il ritmo,
 * e i messaggi che gli stanno attorno.
 *
 * Legge chiunque. Scrive chi ha un account, e il perche e visibile subito:
 * uno arriva qui mentre segna il Foggia, vede venti persone che esultano e
 * vuole esserci anche lui. Quello e il momento buono per chiedergli il nome,
 * non la schermata di apertura.
 */
export default function Live() {
  const gutter = useGutter();
  const ospite = useOspite();
  const match = nextMatch();
  const vivo = liveDi(match, useLive());
  const messaggi = useSala(match?.id ?? null);
  const io = ioSono();

  const [testo, setTesto] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const lista = useRef<ScrollView>(null);

  // ogni messaggio nuovo porta in fondo: e una chat, non un archivio
  useEffect(() => {
    const t = setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [messaggi.length]);

  const aperta = salaAperta(match?.kickoff);

  const invia = async () => {
    const t = testo.trim();
    if (!t || !match) return;
    // stessa regola del database, detta prima di premere
    const esito = controlla(t);
    if (!esito.pulito) return setErrore(spiegazione(esito));

    setErrore(null);
    setInCorso(true);
    try {
      await manda(match.id, t);
      setTesto('');
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non è partito.');
    } finally {
      setInCorso(false);
    }
  };

  if (!match) return <Screen testaFissa><BackBar label="Home" /><Empty text="Nessuna partita in programma." /></Screen>;

  return (
    <Screen scroll={false} senzaBarra>
      <BackBar label="Home" />

      <View style={[styles.testa, gutter]}>
        <Crest uri={match.home.crest} name={match.home.shortName} size={30} />
        <View style={styles.punteggio}>
          <Text style={styles.numeri}>
            {vivo ? `${vivo.casa ?? 0} : ${vivo.ospite ?? 0}` : '– : –'}
          </Text>
          <Text style={styles.fase}>
            {vivo ? etichettaFase(vivo, match.kickoff) : aperta ? 'sta per cominciare' : 'non è ancora ora'}
          </Text>
        </View>
        <Crest uri={match.away.crest} name={match.away.shortName} size={30} />
      </View>

      <View style={[styles.barra, gutter]}>
        <PallinoLive chiusa={!aperta} etichetta={aperta ? 'LIVE CHAT' : 'CHAT CHIUSA'} />
        <Text style={styles.quanti}>
          {messaggi.length === 0 ? 'ancora nessuno' : `${messaggi.length} messaggi`}
        </Text>
      </View>

      <ScrollView
        ref={lista}
        style={styles.lista}
        contentContainerStyle={[gutter, { paddingVertical: space.md, gap: space.sm }]}
        showsVerticalScrollIndicator={false}
      >
        {!messaggi.length ? (
          <Text style={styles.vuoto}>
            {aperta
              ? 'Nessuno ha ancora scritto. Comincia tu.'
              : 'La chat si apre dieci minuti prima del fischio d’inizio.'}
          </Text>
        ) : (
          messaggi.map((m) => (
            <View key={m.id} style={[styles.messaggio, m.utente === io && styles.mio]}>
              <Avatar uri={m.avatar} name={m.autore} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={styles.autore}>{m.autore}</Text>
                <Text style={styles.testoMessaggio}>{m.testo}</Text>
              </View>
              {m.utente === io ? (
                <Premi onPress={() => cancella(match.id, m.id)} scala={1}>
                  <Ionicons name="trash-outline" size={15} color={colors.textFaint} />
                </Premi>
              ) : (
                <AzioniContenuto
                  tipo="messaggio"
                  id={m.id}
                  autore={m.utente}
                  autoreNome={m.autore}
                />
              )}
            </View>
          ))
        )}
      </ScrollView>

      {ospite ? (
        <View style={[gutter, { paddingBottom: space.md }]}>
          <SoloConAccount cosa="Per scrivere nella chat serve un account. Leggere, no." />
        </View>
      ) : (
        <View style={[styles.scrivi, gutter]}>
          {errore ? <Text style={styles.errore}>{errore}</Text> : null}
          <View style={styles.riga}>
            <TextInput
              value={testo}
              onChangeText={(t) => { setTesto(t); if (errore) setErrore(null); }}
              placeholder={aperta
                ? 'Scrivi…'
                : vivo?.finita
                  ? 'La chat è chiusa. Qui resta quello che vi siete detti.'
                  : 'La chat apre dieci minuti prima del fischio'}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              maxLength={LIMITE}
              editable={aperta}
              onSubmitEditing={invia}
              returnKeyType="send"
            />
            <Premi onPress={invia} disabled={!testo.trim() || inCorso || !aperta}>
              <View style={[styles.invia, (!testo.trim() || !aperta) && styles.inviaSpento]}>
                <Ionicons name="arrow-up" size={18} color={colors.onAccent} />
              </View>
            </Premi>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  testa: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  punteggio: { flex: 1, alignItems: 'center' },
  numeri: { ...type.title2, color: colors.text },
  fase: { ...type.caption, color: colors.textDim },

  barra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
  quanti: { ...type.caption, color: colors.textDim },

  lista: { flex: 1 },
  vuoto: { ...type.subhead, color: colors.textDim, textAlign: 'center', marginTop: space.xl },

  messaggio: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.sm,
  },
  mio: { backgroundColor: colors.accentSoft },
  autore: { ...type.captionBold, color: colors.textDim },
  testoMessaggio: { ...type.subhead, color: colors.text },

  scrivi: { paddingBottom: space.md, gap: 6 },
  errore: { ...type.caption, color: colors.accentBright },
  riga: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    flex: 1, backgroundColor: colors.surfaceHi, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 11, ...type.body, color: colors.text,
  },
  invia: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  inviaSpento: { backgroundColor: colors.surfaceHi },
});
