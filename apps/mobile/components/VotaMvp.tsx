import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from './Avatar';
import { SoloConAccount } from './SoloConAccount';
import {
  caricaMvpPartita, classificaMvp, miaPreferenza, scegliMvp, useFanplay,
} from '../lib/fanplay';
import { useOspite } from '../lib/ospite';
import { colors, radius, space, type } from '../theme/tokens';
import type { Player } from '@satanelli/core';

/**
 * Il migliore in campo: si sceglie un nome, uno solo.
 *
 * Non e la pagella. La pagella e un giudizio su ognuno, da 4 a 10; questo e
 * un'elezione: uno puo dare 7 a tutta la squadra e pensare comunque che il
 * migliore sia stato il portiere, e nella media quel pensiero non si vede.
 *
 * Si vota fra chi e sceso in campo davvero, non fra la rosa: chi era in
 * tribuna non puo essere il migliore della partita.
 *
 * La preferenza si cambia finche la finestra e aperta -- a caldo si vota di
 * pancia, e dopo un'ora si cambia idea.
 */
export function VotaMvp({ matchId, giocatori, chiuso = false }: {
  matchId: string;
  /** l'undici sceso in campo */
  giocatori: Player[];
  /** votazione chiusa: si legge il risultato e basta */
  chiuso?: boolean;
}) {
  const ospite = useOspite();
  useFanplay();
  useEffect(() => { void caricaMvpPartita(matchId); }, [matchId]);

  const classifica = classificaMvp(matchId);
  const mia = miaPreferenza(matchId);
  const totale = classifica.reduce((s, x) => s + x.voti, 0);
  const voti = (id: string) => classifica.find((x) => x.giocatore === id)?.voti ?? 0;
  const vincitore = classifica[0];

  if (!giocatori.length) return null;

  return (
    <View style={{ gap: space.sm }}>
      {ospite ? (
        <SoloConAccount cosa="Per scegliere il migliore serve un account. I voti li vedi lo stesso." />
      ) : null}

      {chiuso && vincitore ? (
        <View style={styles.vinto}>
          <Ionicons name="trophy" size={17} color="#E8C547" />
          <Text style={styles.vintoTesto}>
            {`Ha vinto ${nome(giocatori, vincitore.giocatore)} con ${vincitore.voti} ${vincitore.voti === 1 ? 'voto' : 'voti'}`}
          </Text>
        </View>
      ) : null}

      {giocatori.map((p) => {
        const n = voti(p.id);
        const mio = mia === p.id;
        // la barra dice quanto stacca, non quanti sono: con dieci voti in
        // croce le percentuali sarebbero una finta precisione
        const quota = totale ? n / totale : 0;
        return (
          <Pressable
            key={p.id}
            disabled={ospite || chiuso}
            onPress={() => scegliMvp(matchId, p.id)}
            style={({ pressed }) => [
              styles.riga, mio && styles.rigaMia, pressed && !chiuso && { opacity: 0.85 },
            ]}
          >
            <View style={[styles.barra, { width: `${Math.round(quota * 100)}%` }]} />

            <Avatar uri={p.photo ?? null} name={p.shortName ?? p.name} number={p.number} size={32} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.nome, mio && styles.nomeMio]} numberOfLines={1}>
                {p.shortName ?? p.name}
              </Text>
              {n > 0 ? (
                <Text style={styles.quanti}>{n === 1 ? '1 voto' : `${n} voti`}</Text>
              ) : null}
            </View>

            {mio ? (
              <View style={styles.scelto}>
                <Ionicons name="checkmark" size={13} color={colors.onAccent} />
                <Text style={styles.sceltoTesto}>il tuo</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function nome(giocatori: Player[], id: string): string {
  const p = giocatori.find((x) => x.id === id);
  return p?.shortName ?? p?.name ?? id;
}

const styles = StyleSheet.create({
  riga: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.md, paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  rigaMia: { borderColor: colors.accentBright },
  barra: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(229,52,62,0.16)',
  },
  nome: { ...type.subhead, color: colors.text },
  nomeMio: { ...type.subheadBold, color: colors.text },
  quanti: { ...type.caption, color: colors.textDim, marginTop: 1 },
  scelto: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  sceltoTesto: { ...type.captionBold, color: colors.onAccent, fontSize: 10 },
  vinto: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(232,197,71,0.13)', borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: 11,
  },
  vintoTesto: { ...type.subheadBold, color: '#E8C547', flex: 1 },
});
