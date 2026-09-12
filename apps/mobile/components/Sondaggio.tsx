import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, type } from '../theme/tokens';
import { vota, type Sondaggio as Dati } from '../lib/gioco';
import { SoloConAccount } from './SoloConAccount';
import { GroupLabel, GroupNote } from './ui';

/**
 * Un sondaggio.
 *
 * I RISULTATI SI VEDONO SOLO DOPO AVER VOTATO
 *
 * Mostrarli prima cambia la risposta: si guarda la barra piu lunga e ci si
 * accoda. E il motivo per cui i sondaggi seri li nascondono, e vale anche per
 * "come sta giocando il Foggia" all'intervallo.
 *
 * Cambiare idea si puo, finche e aperto: qui non c'e una risposta giusta da
 * proteggere, e uno che si ricrede a caldo e la cosa piu normale del mondo. I
 * punti pero arrivano una volta sola.
 */
export function Sondaggio({ dati, onVotato }: { dati: Dati; onVotato?: () => void }) {
  const [scelta, setScelta] = useState<number | null>(dati.miaScelta);
  const [voti, setVoti] = useState<number[]>(dati.voti);
  const [errore, setErrore] = useState<string | null>(null);

  const totale = voti.reduce((a, b) => a + b, 0);
  const mostraRisultati = scelta !== null || !dati.aperto;

  const tocca = async (i: number) => {
    if (!dati.aperto) return;
    const prima = scelta;
    setErrore(null);
    setScelta(i);
    setVoti((v) => {
      const nuovi = [...v];
      if (prima !== null && nuovi[prima] !== undefined) nuovi[prima] = Math.max(0, nuovi[prima] - 1);
      nuovi[i] = (nuovi[i] ?? 0) + 1;
      return nuovi;
    });

    const r = await vota(dati.id, i);
    if ('errore' in r) {
      setScelta(prima);
      setVoti(dati.voti);
      setErrore(r.errore);
      return;
    }
    onVotato?.();
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.testo}>{dati.testo}</Text>

      <View style={styles.opzioni}>
        {dati.opzioni.map((o, i) => {
          const quanti = voti[i] ?? 0;
          const quota = totale > 0 ? Math.round((quanti / totale) * 100) : 0;
          const mia = scelta === i;
          return (
            <Pressable
              key={o}
              onPress={() => tocca(i)}
              disabled={!dati.aperto}
              style={({ pressed }) => [styles.opzione, mia && styles.mia, pressed && { opacity: 0.7 }]}
            >
              {mostraRisultati ? (
                <View style={[styles.barra, mia && styles.barraMia, { width: `${quota}%` }]} />
              ) : null}
              <Text style={[styles.opzioneTesto, mia && styles.opzioneTestoForte]} numberOfLines={2}>{o}</Text>
              {mostraRisultati ? <Text style={styles.quota}>{quota}%</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sotto}>
        {!dati.aperto ? 'Chiuso. ' : ''}
        {totale === 0
          ? 'Nessun voto per ora.'
          : `${totale} ${totale === 1 ? 'voto' : 'voti'}${scelta === null && dati.aperto ? ' · vota per vedere come la pensano gli altri' : ''}`}
      </Text>

      {errore ? <Text style={styles.errore}>{errore}</Text> : null}
    </View>
  );
}

export function BloccoSondaggi({
  sondaggi, titolo, vuoto, ospite, onVotato,
}: {
  sondaggi: Dati[];
  titolo: string;
  vuoto?: string;
  ospite: boolean;
  onVotato?: () => void;
}) {
  if (sondaggi.length === 0) return vuoto ? <GroupNote>{vuoto}</GroupNote> : null;

  return (
    <>
      <GroupLabel>{titolo}</GroupLabel>
      {ospite ? (
        <View style={{ marginBottom: space.sm }}>
          <SoloConAccount cosa="Per votare nei sondaggi serve un account. Leggere i risultati, no." compatto />
        </View>
      ) : null}
      <View style={{ gap: space.sm }}>
        {sondaggi.map((s) => <Sondaggio key={s.id} dati={s} onVotato={onVotato} />)}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  testo: { ...type.subheadBold, color: colors.text, lineHeight: 21 },
  opzioni: { gap: 6 },
  opzione: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent',
    overflow: 'hidden',
  },
  mia: { borderColor: colors.borderStrong },
  barra: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  barraMia: { backgroundColor: colors.accentSoft },
  opzioneTesto: { ...type.subhead, color: colors.textDim, flex: 1 },
  opzioneTestoForte: { color: colors.text },
  quota: { ...type.captionBold, color: colors.textDim },
  sotto: { ...type.caption, color: colors.textFaint },
  errore: { ...type.caption, color: colors.accentBright },
});
