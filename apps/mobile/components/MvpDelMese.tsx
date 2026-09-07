import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GroupLabel, GroupNote, useGutter } from './ui';
import { Avatar } from './Avatar';
import { matches, squad } from '../lib/data';
import { caricaMvpMese, mvpDelMese, useFanplay } from '../lib/fanplay';
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
  useFanplay();

  // il mese in corso, o quello appena chiuso se ancora non si e giocato
  const { idPartite, etichetta } = useMemo(() => {
    const ora = new Date();
    const giocate = matches
      .filter((m): m is typeof m & { kickoff: string } => m.status === 'finished' && Boolean(m.kickoff))
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
    if (!giocate.length) return { idPartite: [] as string[], etichetta: '' };

    const ultima = new Date(giocate[0]!.kickoff);
    // se nel mese corrente non si e ancora giocato, vale quello dell'ultima gara
    const rif = ultima.getMonth() === ora.getMonth() && ultima.getFullYear() === ora.getFullYear()
      ? ora : ultima;

    const delMese = giocate.filter((m) => {
      const d = new Date(m.kickoff);
      return d.getMonth() === rif.getMonth() && d.getFullYear() === rif.getFullYear();
    });
    return {
      idPartite: delMese.map((m) => m.id),
      etichetta: `${MESI[rif.getMonth()]} ${rif.getFullYear()}`,
    };
  }, []);

  useEffect(() => { void caricaMvpMese(idPartite); }, [idPartite]);
  const classifica = mvpDelMese();

  // niente voti abbastanza: meglio non far comparire una classifica di uno
  if (!classifica.length) return null;

  const primo = classifica[0]!;
  const giocatore = squad.find((p) => p.id === primo.giocatore);

  return (
    <>
      <GroupLabel>{`Il migliore di ${etichetta}`}</GroupLabel>
      <View style={gutter}>
        <View style={styles.scatola}>
          <View style={styles.testa}>
            <Avatar uri={giocatore?.photo ?? null} name={giocatore?.name ?? primo.giocatore} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nome} numberOfLines={1}>
                {giocatore?.shortName ?? giocatore?.name ?? primo.giocatore}
              </Text>
              <Text style={styles.sotto}>
                {primo.partite} {primo.partite === 1 ? 'partita' : 'partite'} · {primo.quanti} voti
              </Text>
            </View>
            <View style={styles.medaglia}>
              <Ionicons name="star" size={13} color="#1A1A1A" />
              <Text style={styles.voto}>{primo.media.toFixed(1)}</Text>
            </View>
          </View>

          {classifica.slice(1, 4).map((x, i) => {
            const p = squad.find((g) => g.id === x.giocatore);
            return (
              <View key={x.giocatore} style={[styles.riga, i === 0 && styles.rigaPrima]}>
                <Text style={styles.posto}>{i + 2}</Text>
                <Text style={styles.rigaNome} numberOfLines={1}>
                  {p?.shortName ?? p?.name ?? x.giocatore}
                </Text>
                <Text style={styles.rigaVoto}>{x.media.toFixed(1)}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <GroupNote>
        Media di tutti i voti del mese, non delle singole partite: chi gioca di più pesa di più.
      </GroupNote>
    </>
  );
}

const styles = StyleSheet.create({
  scatola: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: space.lg, paddingVertical: space.sm,
  },
  testa: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  nome: { ...type.title3, color: colors.text },
  sotto: { ...type.caption, color: colors.textDim, marginTop: 2 },
  medaglia: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E8C547', borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  voto: { ...type.subheadBold, color: '#1A1A1A' },
  riga: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 9 },
  rigaPrima: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  posto: { ...type.captionBold, color: colors.textDim, width: 14 },
  rigaNome: { ...type.subhead, color: colors.text, flex: 1 },
  rigaVoto: { ...type.subheadBold, color: colors.accentBright },
});
