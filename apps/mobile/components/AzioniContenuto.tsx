/**
 * Le azioni su un contenuto scritto da un altro: segnala, blocca, e per chi
 * modera anche nascondi.
 *
 * PERCHE UN COMPONENTE SOLO
 *
 * Discussione, risposta, messaggio della chat e trasferta hanno schermate
 * diverse ma la stessa identica esigenza. Tenerne una copia per schermata vuol
 * dire che fra sei mesi una delle quattro avra il tasto e le altre no — ed e
 * esattamente il tipo di buco per cui Apple rimanda indietro un'app.
 *
 * COSA VEDE CHI
 *
 * Chi non ha un account non vede niente: non puo segnalare ne bloccare, e un
 * tasto che apre "serve un account" a ogni tocco e solo fastidio. Sul proprio
 * contenuto non compare: le proprie cose si modificano e si cancellano, non si
 * segnalano.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, space, type } from '../theme/tokens';
import { Premi } from './anima';
import {
  MOTIVI, blocca, eBloccato, elimina, nascondi, puoModerare, segnala, sblocca, useRuolo,
  type Motivo, type TipoBersaglio,
} from '../lib/moderazione';

export function AzioniContenuto({ tipo, id, autore, autoreNome, onFatto }: {
  tipo: TipoBersaglio;
  id: string;
  /** null quando l'autore non e noto: allora si puo solo segnalare. */
  autore: string | null;
  autoreNome?: string | null;
  /** chiamata dopo un'azione che cambia cosa si vede: la schermata ricarica. */
  onFatto?: () => void;
}) {
  const ruolo = useRuolo();
  const [aperto, setAperto] = useState(false);
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [dettaglio, setDettaglio] = useState('');
  const [esito, setEsito] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [confermaCancella, setConfermaCancella] = useState(false);

  if (ruolo === 'anonimo') return null;

  const bloccato = eBloccato(autore);
  const chiude = () => {
    setAperto(false);
    setMotivo(null);
    setDettaglio('');
    setEsito(null);
    setConfermaCancella(false);
  };

  async function mandaSegnalazione() {
    if (!motivo || inCorso) return;
    setInCorso(true);
    const r = await segnala(tipo, id, motivo, dettaglio);
    setInCorso(false);
    setEsito(r.messaggio);
    if (r.ok) setMotivo(null);
  }

  async function cambiaBlocco() {
    if (!autore || inCorso) return;
    setInCorso(true);
    if (bloccato) {
      await sblocca(autore);
      setEsito('Sbloccato.');
    } else {
      const r = await blocca(autore);
      setEsito(r.messaggio);
    }
    setInCorso(false);
    onFatto?.();
  }

  async function cancellaOra() {
    if (tipo === 'trasferta' || tipo === 'profilo' || inCorso) return;
    setInCorso(true);
    const ok = await elimina(tipo, id);
    setInCorso(false);
    setConfermaCancella(false);
    setEsito(ok ? 'Cancellato. Non c’è più da nessuna parte.' : 'Non è riuscito.');
    onFatto?.();
  }

  async function nascondiOra() {
    if (tipo === 'trasferta' || tipo === 'profilo' || inCorso) return;
    setInCorso(true);
    const esito = await nascondi(tipo, id, true);
    setInCorso(false);
    setEsito(esito.ok ? 'Nascosto a tutti.' : `Non è riuscito. ${esito.perche ?? ''}`.trim());
    onFatto?.();
  }

  return (
    <>
      <Premi onPress={() => setAperto(true)} style={styles.puntini}>
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textFaint} />
      </Premi>

      <Modal visible={aperto} transparent animationType="fade" onRequestClose={chiude}>
        <Pressable style={styles.velo} onPress={chiude}>
          <Pressable style={styles.foglio} onPress={(e) => e.stopPropagation()}>
            <View style={styles.maniglia} />

            {esito ? (
              <View style={{ gap: space.lg }}>
                <Text style={styles.esito}>{esito}</Text>
                <Bottone label="Chiudi" onPress={chiude} />
              </View>
            ) : confermaCancella ? (
              <View style={{ gap: space.sm }}>
                <Text style={styles.titolo}>Cancellare per sempre?</Text>
                <Text style={styles.sotto}>
                  Non si torna indietro e non resta niente, nemmeno nella coda delle
                  segnalazioni. Se basta toglierlo dagli occhi, nascondilo: quello si disfa.
                </Text>
                <Bottone
                  label={inCorso ? 'Un attimo…' : 'Sì, cancella'}
                  onPress={cancellaOra}
                />
                <Bottone label="No, torna indietro" tono="piano" onPress={() => setConfermaCancella(false)} />
              </View>
            ) : motivo === null ? (
              <View style={{ gap: space.sm }}>
                <Text style={styles.titolo}>Segnala questo contenuto</Text>
                <Text style={styles.sotto}>
                  Le segnalazioni si leggono entro 24 ore. Chi ha scritto viene informato.
                </Text>

                {MOTIVI.map((m) => (
                  <Riga key={m} icona="flag-outline" label={m} onPress={() => setMotivo(m)} />
                ))}

                {autore ? (
                  <Riga
                    icona={bloccato ? 'eye-outline' : 'ban-outline'}
                    label={bloccato
                      ? `Sblocca ${autoreNome || 'questa persona'}`
                      : `Blocca ${autoreNome || 'questa persona'}`}
                    sotto={bloccato
                      ? 'Tornerai a vedere quello che scrive.'
                      : 'Non vedrai più niente di suo. Non gli viene detto.'}
                    onPress={cambiaBlocco}
                  />
                ) : null}

                {puoModerare(ruolo) && tipo !== 'trasferta' && tipo !== 'profilo' ? (
                  <Riga
                    icona="eye-off-outline"
                    label="Nascondi a tutti"
                    sotto="Solo chi modera vede questa voce. Si può rimettere."
                    tono="grave"
                    onPress={nascondiOra}
                  />
                ) : null}

                {ruolo === 'admin' && tipo !== 'trasferta' && tipo !== 'profilo' ? (
                  <Riga
                    icona="trash-outline"
                    label="Cancella per sempre"
                    sotto="Non si torna indietro."
                    tono="grave"
                    onPress={() => setConfermaCancella(true)}
                  />
                ) : null}
              </View>
            ) : (
              <View style={{ gap: space.md }}>
                <Text style={styles.titolo}>{motivo}</Text>
                <Text style={styles.sotto}>Aggiungi due righe, se aiutano a capire. Facoltativo.</Text>
                <TextInput
                  value={dettaglio}
                  onChangeText={setDettaglio}
                  placeholder="Cosa è successo"
                  placeholderTextColor={colors.textFaint}
                  multiline
                  maxLength={400}
                  style={styles.campo}
                />
                <Bottone
                  label={inCorso ? 'Invio…' : 'Manda la segnalazione'}
                  onPress={mandaSegnalazione}
                />
                <Bottone label="Indietro" tono="piano" onPress={() => setMotivo(null)} />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Riga({ icona, label, sotto, tono, onPress }: {
  icona: keyof typeof Ionicons.glyphMap;
  label: string;
  sotto?: string;
  tono?: 'grave';
  onPress: () => void;
}) {
  return (
    <Premi onPress={onPress} style={styles.riga}>
      <Ionicons
        name={icona}
        size={20}
        color={tono === 'grave' ? colors.accentBright : colors.textDim}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rigaLabel, tono === 'grave' && { color: colors.accentBright }]}>
          {label}
        </Text>
        {sotto ? <Text style={styles.rigaSotto}>{sotto}</Text> : null}
      </View>
    </Premi>
  );
}

function Bottone({ label, onPress, tono }: {
  label: string;
  onPress: () => void;
  tono?: 'piano';
}) {
  return (
    <Premi onPress={onPress} style={tono === 'piano' ? styles.bottonePiano : styles.bottone}>
      <Text style={[styles.bottoneLabel, tono === 'piano' && { color: colors.text }]}>{label}</Text>
    </Premi>
  );
}

const styles = StyleSheet.create({
  puntini: { paddingHorizontal: space.sm, paddingVertical: 4 },

  velo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  foglio: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xl * 1.5,
    gap: space.md,
  },
  maniglia: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center', marginBottom: space.sm,
  },

  titolo: { ...type.title3, color: colors.text },
  sotto: { ...type.footnote, color: colors.textDim, marginBottom: space.sm },
  esito: { ...type.body, color: colors.text },

  riga: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator,
  },
  rigaLabel: { ...type.body, color: colors.text },
  rigaSotto: { ...type.caption, color: colors.textFaint, marginTop: 1 },

  campo: {
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 88,
    color: colors.text,
    ...type.body,
    textAlignVertical: 'top',
  },

  bottone: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  bottonePiano: {
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  bottoneLabel: { ...type.subheadBold, color: colors.onAccent },
});
