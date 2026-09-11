import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useGutter, ListGroup, ListRow } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Avatar } from '../components/Avatar';
import { RitagliaAvatar } from '../components/RitagliaAvatar';
import { MioProfiloGioco } from '../components/MioProfiloGioco';
import { colors, radius, space, type } from '../theme/tokens';
import { stadium } from '../lib/data';
import {
  cancellaAccount, caricaAvatar, esci, leggiProfilo, rimuoviAvatar,
  salvaProfilo, useSessione, type Profilo,
} from '../lib/auth';

/**
 * Profilo.
 *
 * L'immagine si carica in due passaggi: si sceglie dal telefono, si manda
 * all'archivio, e solo se il caricamento riesce si aggiorna la riga del
 * profilo. Al contrario resterebbe scritto un indirizzo che non esiste.
 */
export default function ProfiloSchermata() {
  // sul web il ritaglio lo facciamo noi: expo-image-picker sa ritagliare solo
  // sulle app native, e oggi l'app si usa dal browser
  const [daRitagliare, setDaRitagliare] = useState<string | null>(null);
  const gutter = useGutter();
  const { utente, caricato } = useSessione();
  const [profilo, setProfilo] = useState<Profilo | null>(null);
  const [nome, setNome] = useState('');
  const [bio, setBio] = useState('');
  const [settore, setSettore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!utente) return;
    leggiProfilo(utente.id).then((p) => {
      if (!p) return;
      setProfilo(p);
      setNome(p.nome);
      setBio(p.bio ?? '');
      setSettore(p.settore);
    });
  }, [utente]);

  if (!caricato) {
    return <Screen testaFissa><View style={styles.attesa}><ActivityIndicator color={colors.accent} /></View></Screen>;
  }

  if (!utente) {
    return (
      <Screen>
        <BackBar label="Indietro" />
        <View style={[styles.vuoto, gutter]}>
          <Ionicons name="person-circle-outline" size={56} color={colors.textFaint} />
          <Text style={styles.titolo}>Non hai ancora un account</Text>
          {/*
            * Si dice cosa si sblocca, non cosa manca.
            *
            * Prima c'era scritto che l'account fa seguire i messaggi "fra
            * telefono e computer": chi legge dal computer si chiede di quale
            * telefono si parli, e comunque non e quello il motivo per cui uno
            * si iscrive. I voti che "entrano nelle medie" erano un dettaglio
            * di come funziona il conteggio, non un motivo per nessuno.
            */}
          <Text style={styles.testo}>
            Serve per scrivere nella Curva e nella chat della partita, votare le pagelle e
            giocare i pronostici. Per leggere non serve.
          </Text>
          <Pressable onPress={() => router.push('/accedi' as never)} style={styles.cta}>
            <Text style={styles.ctaTesto}>Entra</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/accedi?modo=registrazione' as never)}
            style={styles.ctaSecondo}
          >
            <Text style={styles.ctaSecondoTesto}>Crea un account</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const scegliImmagine = async () => {
    setErrore(null); setMessaggio(null);
    const permesso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permesso.granted) {
      setErrore('Serve il permesso di accedere alle foto.');
      return;
    }
    const scelta = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // sulle app native ritaglia il sistema; sul web non fa niente e ci
      // pensa la nostra schermata
      allowsEditing: Platform.OS !== 'web',
      aspect: [1, 1],
      quality: 0.9,
    });
    if (scelta.canceled || !scelta.assets[0]) return;

    if (Platform.OS === 'web') {
      setDaRitagliare(scelta.assets[0].uri);
      return;
    }

    setInCorso(true);
    try {
      const asset = scelta.assets[0];
      // fetch legge sia i percorsi locali del telefono sia i blob del browser
      const risposta = await fetch(asset.uri);
      const blob = await risposta.blob();
      const est = (asset.mimeType ?? blob.type ?? 'image/jpeg').split('/')[1] ?? 'jpeg';
      const r = await caricaAvatar(blob, est === 'jpg' ? 'jpeg' : est);
      if (r.errore) setErrore(r.errore);
      else {
        setProfilo((p) => (p ? { ...p, avatar: r.url } : p));
        setMessaggio('Immagine aggiornata.');
      }
    } catch (e) {
      setErrore('Non sono riuscito a caricare l’immagine.');
    } finally {
      setInCorso(false);
    }
  };

  /** Riceve l'immagine gia ritagliata e ridotta, e la carica. */
  const salvaRitagliata = async (blob: Blob) => {
    setDaRitagliare(null);
    setErrore(null);
    setInCorso(true);
    try {
      const r = await caricaAvatar(blob, 'jpeg');
      if (r.errore) setErrore(r.errore);
      else {
        setProfilo((p) => (p ? { ...p, avatar: r.url } : p));
        setMessaggio('Immagine aggiornata.');
      }
    } catch {
      setErrore('Non sono riuscito a caricare l’immagine.');
    } finally {
      setInCorso(false);
    }
  };

  const salva = async () => {
    setErrore(null); setMessaggio(null); setInCorso(true);
    const r = await salvaProfilo({ nome: nome.trim(), bio: bio.trim() || null, settore });
    setInCorso(false);
    if (r.errore) setErrore(r.errore);
    else setMessaggio('Profilo salvato.');
  };

  const cancella = async () => {
    const conferma = async () => {
      setInCorso(true);
      const r = await cancellaAccount();
      setInCorso(false);
      if (r.errore) setErrore(r.errore);
      else router.replace('/benvenuto' as never);
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm('Cancellare l’account? Vengono rimossi profilo, immagine, voti, pronostici e presenze. Non si torna indietro.')) conferma();
    } else {
      Alert.alert(
        'Cancellare l’account?',
        'Vengono rimossi il profilo, l’immagine, i voti, i pronostici e le presenze. Quello che hai scritto sparisce dalla vista degli altri. Non si torna indietro.',
        [{ text: 'Annulla', style: 'cancel' }, { text: 'Cancella tutto', style: 'destructive', onPress: conferma }],
      );
    }
  };

  return (
    <Screen>
      <BackBar label="Indietro" />

      {daRitagliare ? (
        <RitagliaAvatar
          uri={daRitagliare}
          onFatto={salvaRitagliata}
          onAnnulla={() => setDaRitagliare(null)}
        />
      ) : null}

      <View style={[styles.testa, gutter]}>
        <Pressable onPress={scegliImmagine} disabled={inCorso}>
          {profilo?.avatar ? (
            <Image source={{ uri: profilo.avatar }} style={styles.foto} contentFit="cover" transition={220} />
          ) : (
            <Avatar uri={null} name={nome || 'Tu'} size={92} />
          )}
          <View style={styles.matita}>
            <Ionicons name="camera" size={15} color={colors.onAccent} />
          </View>
        </Pressable>

        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.nome} numberOfLines={1}>{nome || 'Il tuo nome'}</Text>
          <Text style={styles.email} numberOfLines={1}>{utente.email}</Text>
          {profilo?.avatar ? (
            <Pressable onPress={async () => { await rimuoviAvatar(); setProfilo((p) => (p ? { ...p, avatar: null } : p)); }}>
              <Text style={styles.rimuovi}>Togli l’immagine</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {errore ? <Riquadro tono="errore" testo={errore} gutter={gutter} /> : null}
      {messaggio ? <Riquadro tono="ok" testo={messaggio} gutter={gutter} /> : null}

      <View style={[styles.campi, gutter]}>
        <Campo etichetta="Nome">
          <TextInput value={nome} onChangeText={setNome} style={styles.input} maxLength={40} />
        </Campo>

        <Campo etichetta={`Due righe su di te${bio ? ` · ${bio.length}/200` : ''}`}>
          <TextInput
            value={bio} onChangeText={setBio}
            placeholder="Da quanto segui il Foggia, dove guardi le partite…"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.area]} multiline maxLength={200} textAlignVertical="top"
          />
        </Campo>

        <Campo etichetta="Dove stai di solito">
          <View style={styles.settori}>
            {stadium.sectors.filter((s) => s.id !== 'settore-ospiti').map((s) => {
              const on = settore === s.id;
              return (
                <Pressable key={s.id} onPress={() => setSettore(on ? null : s.id)} style={[styles.settore, on && styles.settoreOn]}>
                  <Text style={[styles.settoreTesto, on && styles.settoreTestoOn]}>{s.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Campo>

        <Pressable onPress={salva} disabled={inCorso} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
          <Text style={styles.ctaTesto}>{inCorso ? 'Un momento…' : 'Salva'}</Text>
        </Pressable>
      </View>

      <MioProfiloGioco />

      <View style={[gutter, { marginTop: space.xl }]}>
        <ListGroup>
          <ListRow onPress={() => router.push('/classifica' as never)} chevron>
            <Text style={styles.voce}>La classifica</Text>
          </ListRow>
          <ListRow onPress={() => router.push('/notifiche' as never)} chevron>
            <Text style={styles.voce}>Notifiche</Text>
          </ListRow>
          {/* si deve poter tornare indietro da un blocco: un blocco che non si
              toglie non e una tutela, e una trappola — e Apple lo chiede */}
          <ListRow onPress={() => router.push('/segnalazioni' as never)} chevron>
            <Ionicons name="flag-outline" size={19} color={colors.textDim} />
            <Text style={styles.voce}>Segnalazioni</Text>
          </ListRow>
          <ListRow onPress={() => router.push('/bloccati' as never)} chevron>
            <Ionicons name="ban-outline" size={19} color={colors.textDim} />
            <Text style={styles.voce}>Persone bloccate</Text>
          </ListRow>
          <ListRow onPress={() => router.push('/privacy' as never)} chevron>
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.textDim} />
            <Text style={styles.voce}>Informativa privacy</Text>
          </ListRow>
          <ListRow onPress={() => router.push('/condizioni' as never)} chevron>
            <Ionicons name="document-text-outline" size={19} color={colors.textDim} />
            <Text style={styles.voce}>Condizioni d’uso</Text>
          </ListRow>
          <ListRow onPress={() => { esci(); router.back(); }}>
            <Ionicons name="log-out-outline" size={19} color={colors.textDim} />
            <Text style={styles.voce}>Esci</Text>
          </ListRow>
          <ListRow onPress={cancella}>
            <Ionicons name="trash-outline" size={19} color={colors.loss} />
            <Text style={[styles.voce, { color: colors.loss }]}>Cancella l’account e i dati</Text>
          </ListRow>
        </ListGroup>
      </View>
    </Screen>
  );
}

function Campo({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.etichetta}>{etichetta.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Riquadro({ tono, testo, gutter }: { tono: 'ok' | 'errore'; testo: string; gutter: object }) {
  const ok = tono === 'ok';
  return (
    <View style={[styles.riquadro, gutter, { backgroundColor: ok ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)' }]}>
      <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={16} color={ok ? colors.win : colors.loss} />
      <Text style={styles.riquadroTesto}>{testo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  attesa: { paddingTop: space.xxxl, alignItems: 'center' },
  vuoto: { alignItems: 'center', gap: space.md, marginTop: space.xxl },
  titolo: { ...type.title2, color: colors.text },
  testo: { ...type.subhead, color: colors.textDim, textAlign: 'center', lineHeight: 21 },

  testa: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.lg },
  foto: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.surface },
  matita: {
    position: 'absolute', right: -2, bottom: -2,
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  nome: { ...type.title3, color: colors.text },
  email: { ...type.caption, color: colors.textFaint },
  rimuovi: { ...type.caption, color: colors.accentBright, marginTop: 4 },

  riquadro: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', borderRadius: radius.lg, padding: space.md, marginTop: space.md },
  riquadroTesto: { ...type.footnote, color: colors.text, flex: 1 },

  campi: { gap: space.lg, marginTop: space.xl },
  etichetta: { ...type.caption, color: colors.textFaint, letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: space.lg, paddingVertical: 13,
    ...type.body, color: colors.text,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  area: { minHeight: 92, paddingTop: 13 },

  settori: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  settore: { paddingHorizontal: space.md, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface },
  settoreOn: { backgroundColor: colors.accent },
  settoreTesto: { ...type.footnoteBold, color: colors.textDim },
  settoreTestoOn: { color: colors.onAccent },

  cta: { borderRadius: radius.xl, paddingVertical: 15, alignItems: 'center', backgroundColor: colors.accent, marginTop: space.sm },
  ctaTesto: { ...type.headline, color: colors.onAccent },
  ctaSecondo: {
    borderRadius: radius.xl, paddingVertical: 14, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong,
  },
  ctaSecondoTesto: { ...type.subheadBold, color: colors.text },

  voce: { ...type.body, color: colors.text, flex: 1 },
});
