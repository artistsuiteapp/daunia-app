/**
 * Le segnalazioni. Una schermata, due mestieri.
 *
 * Per chi ha un account normale: quelle che ha mandato lui, e com'e finita.
 * Senza questa parte una segnalazione e un messaggio in bottiglia — mandi e non
 * sai piu niente, e la volta dopo non segnali piu.
 *
 * Per chi modera: la coda di quello che aspetta un giudizio, con il testo sotto
 * gli occhi. Una riga per contenuto, non per segnalazione: un messaggio con sei
 * segnalazioni deve occupare una riga sola.
 *
 * LA REGOLA CHE VALE DI PIU
 *
 * "Respinta" rimette in chiaro quello che la soglia aveva nascosto. Se
 * assolvere non riportasse indietro il contenuto, la sparizione automatica
 * sarebbe una condanna senza appello, e tre persone d'accordo basterebbero a
 * zittire chiunque per sempre.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen, LargeTitle, Empty, GroupLabel, GroupNote, ListGroup, ListRow, useGutter } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Premi } from '../components/anima';
import { colors, radius, space, type } from '../theme/tokens';
import { relative } from '../lib/format';
import {
  chiudi, coda, mieSegnalazioni, puoModerare, testoSegnalato, useRuolo,
  type MiaSegnalazione, type Segnalato, type VoceCoda,
} from '../lib/moderazione';

const NOME_TIPO: Record<string, string> = {
  discussione: 'Discussione',
  risposta: 'Commento',
  messaggio: 'Chat dal vivo',
  trasferta: 'Trasferta',
  profilo: 'Profilo',
};

export default function Segnalazioni() {
  const ruolo = useRuolo();
  const gutter = useGutter();
  const modera = puoModerare(ruolo);

  const [mie, setMie] = useState<MiaSegnalazione[]>([]);
  const [lista, setLista] = useState<VoceCoda[]>([]);

  const aggiorna = useCallback(async () => {
    setMie(await mieSegnalazioni());
    if (modera) setLista(await coda());
  }, [modera]);

  useEffect(() => { void aggiorna(); }, [aggiorna]);

  const aperte = lista.filter((v) => v.stato === 'aperta');
  const chiuse = lista.filter((v) => v.stato !== 'aperta');

  return (
    <Screen>
      <BackBar label="Profilo" />
      <LargeTitle
        title="Segnalazioni"
        subtitle={modera ? 'Quello che aspetta un giudizio' : 'Quelle che hai mandato'}
      />

      {modera ? (
        <>
          <GroupLabel>{aperte.length ? `Da vedere · ${aperte.length}` : 'Da vedere'}</GroupLabel>
          {aperte.length === 0 ? (
            <Empty text="Niente in coda. Buon segno." />
          ) : (
            aperte.map((v) => (
              <Voce key={`${v.tipo}:${v.bersaglio}`} voce={v} onFatto={aggiorna} />
            ))
          )}

          {chiuse.length ? (
            <>
              <GroupLabel>Già viste</GroupLabel>
              <View style={gutter}>
                <ListGroup>
                  {chiuse.slice(0, 20).map((v) => (
                    <ListRow key={`${v.tipo}:${v.bersaglio}`}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rigaTitolo}>
                          {NOME_TIPO[v.tipo] ?? v.tipo} · {v.quante}
                        </Text>
                        <Text style={styles.rigaMeta}>
                          {v.stato === 'accolta' ? 'Rimosso' : 'Lasciato dov’era'} · {relative(v.ultima_il)}
                        </Text>
                      </View>
                    </ListRow>
                  ))}
                </ListGroup>
              </View>
            </>
          ) : null}
        </>
      ) : null}

      <GroupLabel>{modera ? 'Mandate da te' : 'Le tue segnalazioni'}</GroupLabel>
      {mie.length === 0 ? (
        <Empty text="Non hai segnalato niente." />
      ) : (
        <View style={gutter}>
          <ListGroup>
            {mie.map((s) => (
              <ListRow key={s.id}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rigaTitolo}>{NOME_TIPO[s.tipo] ?? s.tipo}</Text>
                  <Text style={styles.rigaMeta} numberOfLines={2}>{s.motivo}</Text>
                </View>
                <Text style={[styles.stato, s.stato === 'accolta' && { color: colors.win }]}>
                  {s.stato === 'aperta' ? 'in attesa' : s.stato === 'accolta' ? 'accolta' : 'respinta'}
                </Text>
              </ListRow>
            ))}
          </ListGroup>
        </View>
      )}

      <GroupNote>
        {modera
          ? 'Respingere rimette in chiaro il contenuto che la soglia aveva nascosto. Tre persone d’accordo bastano a far sparire qualcosa: per questo la revisione conta.'
          : 'Ogni segnalazione la legge una persona. Se anche altri segnalano lo stesso contenuto, quello sparisce subito in attesa che venga rivisto.'}
      </GroupNote>
    </Screen>
  );
}

function Voce({ voce, onFatto }: { voce: VoceCoda; onFatto: () => void }) {
  const gutter = useGutter();
  const [testo, setTesto] = useState<Segnalato | null>(null);
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    let vivo = true;
    void testoSegnalato(voce.tipo, voce.bersaglio).then((t) => { if (vivo) setTesto(t); });
    return () => { vivo = false; };
  }, [voce.tipo, voce.bersaglio]);

  async function decidi(esito: 'accolta' | 'respinta') {
    if (inCorso) return;
    setInCorso(true);
    await chiudi(voce.tipo, voce.bersaglio, esito);
    setInCorso(false);
    onFatto();
  }

  return (
    <View style={[styles.scheda, gutter]}>
      <Text style={styles.schedaCapo}>
        {NOME_TIPO[voce.tipo] ?? voce.tipo} · {voce.quante} {voce.quante === 1 ? 'segnalazione' : 'segnalazioni'}
        {testo?.nascosto ? ' · già nascosto' : ''}
      </Text>

      {testo ? (
        <>
          <Text style={styles.schedaAutore}>{testo.nome} · {relative(testo.quando)}</Text>
          <Text style={styles.schedaTesto} numberOfLines={8}>{testo.testo}</Text>
        </>
      ) : (
        <Text style={styles.schedaTesto}>Contenuto non più disponibile.</Text>
      )}

      <View style={styles.motivi}>
        {[...new Set(voce.motivi)].slice(0, 4).map((m) => (
          <Text key={m} style={styles.motivo}>{m}</Text>
        ))}
      </View>

      <View style={styles.tasti}>
        <Premi onPress={() => decidi('respinta')} style={styles.tastoPiano}>
          <Text style={styles.tastoPianoTesto}>Lascialo, è a posto</Text>
        </Premi>
        <Premi onPress={() => decidi('accolta')} style={styles.tastoGrave}>
          <Text style={styles.tastoGraveTesto}>Rimuovi</Text>
        </Premi>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rigaTitolo: { ...type.subheadBold, color: colors.text },
  rigaMeta: { ...type.caption, color: colors.textFaint, marginTop: 1 },
  stato: { ...type.caption, color: colors.textDim },

  scheda: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    marginBottom: space.md,
  },
  schedaCapo: { ...type.footnoteBold, color: colors.accentBright },
  schedaAutore: { ...type.caption, color: colors.textFaint },
  schedaTesto: { ...type.body, color: colors.text },

  motivi: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  motivo: {
    ...type.caption,
    color: colors.textDim,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },

  tasti: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  tastoPiano: {
    flex: 1,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  tastoPianoTesto: { ...type.footnoteBold, color: colors.text },
  tastoGrave: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  tastoGraveTesto: { ...type.footnoteBold, color: colors.onAccent },
});
