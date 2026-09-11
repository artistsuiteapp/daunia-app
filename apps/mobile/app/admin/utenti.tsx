import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, LargeTitle, Empty, GroupNote, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { Avatar } from '../../components/Avatar';
import { NomeUtente } from '../../components/NomeUtente';
import { Premi } from '../../components/anima';
import { colors, radius, space, type } from '../../theme/tokens';
import { shortDate } from '../../lib/format';
import { useRuolo, puoModerare } from '../../lib/moderazione';
import { useSessione } from '../../lib/auth';
import {
  cambiaRuolo, eBandito, eSospeso, riammetti, sospendiUtente, useElencoUtenti,
  type UtenteInElenco,
} from '../../lib/pannello';

/**
 * Le persone.
 *
 * PERCHE LE AZIONI STANNO IN UN FOGLIO E NON NELLA RIGA
 *
 * Sospendere e bandire sono cose che si fanno raramente e che non si disfano
 * con un tocco. Un tasto "bandisci" dentro una riga di lista, accanto a un dito
 * che scorre, prima o poi viene premuto per sbaglio. Cosi invece si tocca il
 * nome, si legge chi e, e solo dopo si sceglie.
 *
 * COSA SI VEDE NELLA RIGA
 *
 * Livello e punti — per capire se e uno che sta qui da tempo — e il numero di
 * segnalazioni aperte, che e la cosa che fa decidere quale riga guardare.
 */
export default function Utenti() {
  const ruolo = useRuolo();
  const gutter = useGutter();
  const { utente: io } = useSessione();
  const [cerca, setCerca] = useState('');
  const { righe, caricato, ricarica } = useElencoUtenti(cerca);
  const [scelto, setScelto] = useState<UtenteInElenco | null>(null);

  if (!puoModerare(ruolo)) {
    return (
      <Screen>
        <BackBar label="Pannello" />
        <Empty text="Questa parte è per chi modera." />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackBar label="Pannello" />
      <LargeTitle title="Persone" subtitle={`${righe.length} iscritte`} />

      <View style={[gutter, stili.cerca]}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          value={cerca}
          onChangeText={setCerca}
          placeholder="Cerca per nome"
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
          style={stili.campoCerca}
        />
        {cerca ? (
          <Pressable onPress={() => setCerca('')} hitSlop={10}>
            <Ionicons name="close-circle" size={17} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {!caricato ? (
        <View style={stili.attesa}><ActivityIndicator color={colors.accent} /></View>
      ) : righe.length === 0 ? (
        <Empty text="Nessuno con questo nome." />
      ) : (
        <View style={[gutter, { gap: space.sm, marginTop: space.md }]}>
          {righe.map((u) => (
            <Riga key={u.utente} u={u} sonoIo={u.utente === io?.id} onPress={() => setScelto(u)} />
          ))}
        </View>
      )}

      <GroupNote>
        Sospendere toglie la parola fino alla data e non cancella niente di quello che è già scritto.
        Bandire è la stessa cosa senza scadenza.
      </GroupNote>

      <Foglio
        u={scelto}
        admin={ruolo === 'admin'}
        onChiudi={() => setScelto(null)}
        onFatto={() => { setScelto(null); void ricarica(); }}
      />
    </Screen>
  );
}

function Riga({ u, sonoIo, onPress }: { u: UtenteInElenco; sonoIo: boolean; onPress: () => void }) {
  const fermo = eSospeso(u.sospesoFino);
  return (
    <Premi onPress={onPress} style={[stili.riga, fermo && stili.rigaFerma]}>
      <Avatar uri={u.avatar} name={u.nome} size={38} />
      <View style={{ flex: 1, gap: 2 }}>
        <NomeUtente
          id={u.utente}
          nome={u.nome}
          apribile={false}
          suffisso={sonoIo ? '· tu' : undefined}
        />
        <Text style={stili.sotto}>
          {u.livello.nome} · {u.punti} punti · dal {shortDate(u.iscrittoIl)}
        </Text>
      </View>
      {u.segnalazioni > 0 ? (
        <View style={stili.segnalazioni}>
          <Ionicons name="flag" size={11} color={colors.accentBright} />
          <Text style={stili.segnalazioniTesto}>{u.segnalazioni}</Text>
        </View>
      ) : null}
      {fermo ? (
        <Ionicons
          name={eBandito(u.sospesoFino) ? 'ban' : 'time-outline'}
          size={17}
          color={colors.accentBright}
        />
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Premi>
  );
}

/**
 * Il foglio delle azioni.
 *
 * Un moderatore vede solo sospendere e riammettere. Cambiare un ruolo lo fa
 * solo un admin — e comunque il database rifiuterebbe, ma un tasto che
 * risponde "non puoi" e peggio di un tasto che non c'e.
 */
function Foglio({ u, admin, onChiudi, onFatto }: {
  u: UtenteInElenco | null;
  admin: boolean;
  onChiudi: () => void;
  onFatto: () => void;
}) {
  const [esito, setEsito] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [conferma, setConferma] = useState<null | 'bando'>(null);

  const chiude = () => { setEsito(null); setConferma(null); onChiudi(); };

  async function fai(azione: () => Promise<{ ok: boolean; messaggio: string }>) {
    if (inCorso) return;
    setInCorso(true);
    const r = await azione();
    setInCorso(false);
    setEsito(r.messaggio);
    if (r.ok) setConferma(null);
  }

  if (!u) return null;
  const fermo = eSospeso(u.sospesoFino);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={chiude}>
      <Pressable style={stili.velo} onPress={chiude}>
        <Pressable style={stili.foglio} onPress={(e) => e.stopPropagation()}>
          <View style={stili.maniglia} />

          <View style={stili.testa}>
            <Avatar uri={u.avatar} name={u.nome} size={44} />
            <View style={{ flex: 1 }}>
              <NomeUtente id={u.utente} nome={u.nome} apribile={false} stile={type.title3} />
              <Text style={stili.sotto}>
                {u.ruolo === 'utente' ? u.livello.nome : u.ruolo} · {u.punti} punti
                {fermo ? eBandito(u.sospesoFino) ? ' · bandito' : ` · sospeso fino al ${shortDate(u.sospesoFino!)}` : ''}
              </Text>
            </View>
          </View>

          {esito ? (
            <View style={{ gap: space.lg }}>
              <Text style={stili.esito}>{esito}</Text>
              <Azione icona="checkmark" label="Chiudi" onPress={() => { setEsito(null); onFatto(); }} />
            </View>
          ) : conferma === 'bando' ? (
            <View style={{ gap: space.sm }}>
              <Text style={stili.domanda}>Bandire {u.nome} per sempre?</Text>
              <Text style={stili.sotto}>
                Non potrà più scrivere niente, in nessuna parte dell’app. Quello che ha già
                scritto resta dov’è. Si può togliere in qualsiasi momento.
              </Text>
              <Azione
                icona="ban"
                label={inCorso ? 'Un attimo…' : 'Sì, bandisci'}
                grave
                onPress={() => fai(() => sospendiUtente(u.utente, null))}
              />
              <Azione icona="arrow-back" label="No, torna indietro" onPress={() => setConferma(null)} />
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              {fermo ? (
                <Azione
                  icona="lock-open-outline"
                  label="Riammetti"
                  sotto="Torna a poter scrivere subito."
                  onPress={() => fai(() => riammetti(u.utente))}
                />
              ) : (
                <>
                  <Azione icona="time-outline" label="Sospendi un giorno"
                    onPress={() => fai(() => sospendiUtente(u.utente, 1))} />
                  <Azione icona="time-outline" label="Sospendi una settimana"
                    onPress={() => fai(() => sospendiUtente(u.utente, 7))} />
                  <Azione icona="time-outline" label="Sospendi un mese"
                    onPress={() => fai(() => sospendiUtente(u.utente, 30))} />
                  <Azione icona="ban" label="Bandisci per sempre" grave
                    onPress={() => setConferma('bando')} />
                </>
              )}

              {admin && u.ruolo !== 'admin' ? (
                u.ruolo === 'moderatore' ? (
                  <Azione
                    icona="arrow-down-outline"
                    label="Togli da moderatore"
                    onPress={() => fai(() => cambiaRuolo(u.utente, 'utente'))}
                  />
                ) : (
                  <Azione
                    icona="shield-half"
                    label="Fai moderatore"
                    sotto="Potrà nascondere contenuti e sospendere."
                    onPress={() => fai(() => cambiaRuolo(u.utente, 'moderatore'))}
                  />
                )
              ) : null}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Azione({ icona, label, sotto, grave, onPress }: {
  icona: keyof typeof Ionicons.glyphMap;
  label: string;
  sotto?: string;
  grave?: boolean;
  onPress: () => void;
}) {
  return (
    <Premi onPress={onPress} style={stili.azione}>
      <Ionicons name={icona} size={20} color={grave ? colors.accentBright : colors.textDim} />
      <View style={{ flex: 1 }}>
        <Text style={[stili.azioneLabel, grave && { color: colors.accentBright }]}>{label}</Text>
        {sotto ? <Text style={stili.azioneSotto}>{sotto}</Text> : null}
      </View>
    </Premi>
  );
}

const stili = StyleSheet.create({
  cerca: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: 10, marginTop: space.sm,
  },
  campoCerca: { flex: 1, color: colors.text, ...type.body, paddingVertical: 0 },
  attesa: { paddingVertical: space.xxl, alignItems: 'center' },

  riga: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  rigaFerma: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accentSoft },
  sotto: { ...type.caption, color: colors.textFaint },
  segnalazioni: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accentSoft, borderRadius: radius.pill,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  segnalazioniTesto: { ...type.captionBold, color: colors.accentBright },

  velo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  foglio: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: space.lg, paddingBottom: space.xxl + space.lg, gap: space.lg,
  },
  maniglia: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong,
    alignSelf: 'center',
  },
  testa: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  esito: { ...type.body, color: colors.text },
  domanda: { ...type.title3, color: colors.text },

  azione: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator,
  },
  azioneLabel: { ...type.body, color: colors.text },
  azioneSotto: { ...type.caption, color: colors.textFaint, marginTop: 1 },
});
