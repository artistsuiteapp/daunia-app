import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GroupLabel, GroupNote, useGutter } from './ui';
import { Avatar } from './Avatar';
import { matches, squad } from '../lib/data';
import {
  caricaMvpMese, classificaMvpMese, miaPreferenzaMese, scegliMvpMese, useFanplay,
} from '../lib/fanplay';
import { statoMese, meseChiuso } from '../lib/premi-core';
import { lineupPerPartita } from '../lib/lineup';
import { useOspite } from '../lib/ospite';
import { Pressable } from 'react-native';
import { colors, radius, space, type } from '../theme/tokens';

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/**
 * Il migliore del mese, votato dalla Curva.
 *
 * Le pagelle della singola partita si guardano il giorno dopo e poi si
 * dimenticano. Questo tiene il conto piu lungo, ed e la cosa per cui uno
 * torna a votare anche quando la partita e finita male: un mese e la
 * distanza giusta -- una settimana e rumore, una stagione e troppo lontana
 * per farci caso.
 *
 * Le partite del mese le sceglie l'app dal calendario e le passa al
 * database: `voti` sa quando e stato dato il voto, non quando si e giocato,
 * e chi vota lunedi la partita di domenica finirebbe nel mese sbagliato.
 */
export function MvpDelMese() {
  const gutter = useGutter();
  const ospite = useOspite();
  useFanplay();

  const { mese, chiuso } = statoMese();

  /*
   * Chi si puo votare: chi ha giocato almeno una partita del mese.
   *
   * Non tutta la rosa: un premio dove si puo scegliere anche chi non e mai
   * sceso in campo non e un premio, e una lista di nomi.
   */
  const candidati = useMemo(() => {
    const delMese = matches.filter(
      (m): m is typeof m & { kickoff: string } =>
        m.status === 'finished' && Boolean(m.kickoff) && String(m.kickoff).slice(0, 7) === mese,
    );
    const visti = new Set<string>();
    for (const m of delMese) {
      for (const s of lineupPerPartita(m.kickoff.slice(0, 10), m.id).slots) {
        if (s.player) visti.add(s.player.id);
      }
    }
    return squad.filter((p) => visti.has(p.id));
  }, [mese]);

  useEffect(() => { void caricaMvpMese(mese); }, [mese]);

  const classifica = classificaMvpMese(mese);
  const mia = miaPreferenzaMese(mese);
  const totale = classifica.reduce((s, x) => s + x.voti, 0);
  const votiDi = (id: string) => classifica.find((x) => x.giocatore === id)?.voti ?? 0;
  const vincitore = classifica[0];
  const finito = chiuso || meseChiuso(mese);

  // niente partite quel mese: non c'e niente da votare e niente da mostrare
  if (!candidati.length) return null;

  const etichetta = `${MESI[Number(mese.slice(5, 7)) - 1]} ${mese.slice(0, 4)}`;

  return (
    <>
      <GroupLabel>{finito ? `Il migliore di ${etichetta}` : `Il migliore di ${etichetta}, finora`}</GroupLabel>
      <View style={[gutter, { gap: space.xs }]}>
        {finito && vincitore ? (
          <View style={styles.vinto}>
            <Avatar
              uri={squad.find((p) => p.id === vincitore.giocatore)?.photo ?? null}
              name={vincitore.giocatore}
              size={44}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.nomeVinto} numberOfLines={1}>
                {squad.find((p) => p.id === vincitore.giocatore)?.shortName ?? vincitore.giocatore}
              </Text>
              <Text style={styles.sottoVinto}>
                {`${vincitore.voti} ${vincitore.voti === 1 ? 'voto' : 'voti'} · mese chiuso`}
              </Text>
            </View>
            <Ionicons name="trophy" size={22} color="#E8C547" />
          </View>
        ) : null}

        {/* i primi cinque: la lista intera sarebbe venticinque nomi e nessuno
            la scorre fino in fondo */}
        {candidati
          .map((p) => ({ p, voti: votiDi(p.id) }))
          .sort((a, b) => b.voti - a.voti || (a.p.shortName ?? '').localeCompare(b.p.shortName ?? ''))
          .slice(0, finito ? 5 : 8)
          .map(({ p, voti }) => {
            const mio = mia === p.id;
            const quota = totale ? voti / totale : 0;
            return (
              <Pressable
                key={p.id}
                disabled={ospite || finito}
                onPress={() => scegliMvpMese(mese, p.id)}
                style={({ pressed }) => [
                  styles.riga, mio && styles.rigaMia, pressed && !finito && { opacity: 0.85 },
                ]}
              >
                <View style={[styles.barra, { width: `${Math.round(quota * 100)}%` }]} />
                <Avatar uri={p.photo ?? null} name={p.shortName ?? p.name} number={p.number} size={30} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nome, mio && styles.nomeMio]} numberOfLines={1}>
                    {p.shortName ?? p.name}
                  </Text>
                  {voti > 0 ? (
                    <Text style={styles.quanti}>{voti === 1 ? '1 voto' : `${voti} voti`}</Text>
                  ) : null}
                </View>
                {mio ? (
                  <View style={styles.scelto}>
                    <Ionicons name="checkmark" size={12} color={colors.onAccent} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
      </View>
      <GroupNote>
        {finito
          ? 'Le votazioni del mese sono chiuse. Il prossimo verdetto arriva il primo del mese.'
          : 'Si vota fra chi è sceso in campo questo mese. Puoi cambiare idea fino all’ultimo giorno.'}
      </GroupNote>
    </>
  );
}

const styles = StyleSheet.create({
  nome: { ...type.subhead, color: colors.text },
  riga: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.md, paddingVertical: 9,
    borderRadius: radius.md, overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)',
  },
  rigaMia: { borderColor: colors.accentBright },
  barra: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(229,52,62,0.16)' },
  nomeMio: { ...type.subheadBold, color: colors.text },
  quanti: { ...type.caption, color: colors.textDim, marginTop: 1 },
  scelto: {
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: 7, paddingVertical: 4,
  },
  vinto: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: 'rgba(232,197,71,0.12)', borderRadius: radius.lg,
    padding: space.md, marginBottom: space.xs,
  },
  nomeVinto: { ...type.title3, color: colors.text },
  sottoVinto: { ...type.caption, color: colors.textDim, marginTop: 2 },
});
