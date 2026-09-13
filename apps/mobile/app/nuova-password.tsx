import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useGutter } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { BrandMark } from '../components/BrandMark';
import { SfondoCitta } from '../components/SfondoCitta';
import { colors, radius, space, type } from '../theme/tokens';
import { cambiaPassword, entraDaCollegamento, useSessione } from '../lib/auth';

/**
 * La password nuova, dopo il collegamento dell'email.
 *
 * Mancava del tutto: l'email di recupero partiva, il collegamento funzionava,
 * e poi nessuna schermata chiedeva la password nuova. Chi l'aveva dimenticata
 * restava fuori.
 */
export default function NuovaPassword() {
  const gutter = useGutter();
  const sessione = useSessione();
  const url = Linking.useURL();
  const provato = useRef<string | null>(null);

  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const [mostra, setMostra] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [attesa, setAttesa] = useState(true);

  // sul telefono i dati di accesso arrivano nell'indirizzo, e vanno usati una volta
  useEffect(() => {
    if (Platform.OS === 'web' || !url || provato.current === url) return;
    provato.current = url;
    void entraDaCollegamento(url).then((r) => { if (r.errore) setErrore(r.errore); });
  }, [url]);

  // un attimo per lasciare arrivare la sessione, prima di dire che manca
  useEffect(() => {
    const t = setTimeout(() => setAttesa(false), 2500);
    return () => clearTimeout(t);
  }, []);

  const dentro = Boolean(sessione.utente);
  const pronto = password.length >= 8 && password === conferma;

  const salva = async () => {
    setErrore(null);
    if (password !== conferma) return setErrore('Le due password non coincidono.');
    setInCorso(true);
    try {
      const r = await cambiaPassword(password);
      if (r.errore) return setErrore(r.errore);
      setFatto(true);
    } finally {
      setInCorso(false);
    }
  };

  return (
    <Screen senzaBarra>
      <SfondoCitta intensita={0.55} />
      <BackBar label="Indietro" />

      <View style={[styles.wrap, gutter]}>
        <BrandMark size={72} />
        <Text style={styles.titolo}>{fatto ? 'Password cambiata' : 'Scegli la password nuova'}</Text>

        {fatto ? (
          <>
            <Text style={styles.testo}>Da adesso si entra con quella nuova, su tutti i dispositivi.</Text>
            <Pressable onPress={() => router.replace('/' as never)} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
              <Text style={styles.ctaTesto}>Vai alla home</Text>
            </Pressable>
          </>
        ) : !dentro ? (
          <>
            <Text style={styles.testo}>
              {errore ?? (attesa
                ? 'Un momento, sto aprendo il collegamento…'
                : 'Apri il collegamento arrivato per email da questo dispositivo. Se è passato troppo tempo, chiedine uno nuovo.')}
            </Text>
            {!attesa || errore ? (
              <Pressable
                onPress={() => router.replace('/accedi?modo=recupero' as never)}
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.ctaTesto}>Chiedi un nuovo collegamento</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.testo}>Almeno 8 caratteri. Scrivila due volte, così un errore di battitura non ti chiude fuori.</Text>

            <View style={styles.campo}>
              <Text style={styles.etichetta}>PASSWORD NUOVA</Text>
              <View style={styles.passwordRiga}>
                <TextInput
                  value={password} onChangeText={setPassword}
                  placeholder="••••••••" placeholderTextColor={colors.textFaint}
                  style={[styles.input, { flex: 1 }]}
                  secureTextEntry={!mostra} autoCapitalize="none"
                  autoComplete="new-password" textContentType="newPassword"
                />
                <Pressable onPress={() => setMostra((v) => !v)} hitSlop={10} style={styles.occhio}>
                  <Ionicons name={mostra ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.textDim} />
                </Pressable>
              </View>
            </View>

            <View style={styles.campo}>
              <Text style={styles.etichetta}>DI NUOVO</Text>
              <TextInput
                value={conferma} onChangeText={setConferma}
                placeholder="••••••••" placeholderTextColor={colors.textFaint}
                style={styles.input}
                secureTextEntry={!mostra} autoCapitalize="none"
                autoComplete="new-password" textContentType="newPassword"
              />
            </View>

            {errore ? (
              <View style={styles.errore}>
                <Ionicons name="alert-circle" size={16} color={colors.loss} />
                <Text style={styles.erroreTesto}>{errore}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={salva}
              disabled={!pronto || inCorso}
              style={({ pressed }) => [styles.cta, (!pronto || inCorso) && styles.ctaOff, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.ctaTesto, (!pronto || inCorso) && styles.ctaTestoOff]}>
                {inCorso ? 'Un momento…' : 'Salva la password'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, marginTop: space.lg, alignItems: 'stretch' },
  titolo: { ...type.displayTitle, color: colors.text },
  testo: { ...type.subhead, color: colors.textDim, lineHeight: 21, marginTop: -space.sm },

  campo: { gap: space.sm },
  etichetta: { ...type.caption, color: colors.textFaint, letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(18,18,22,0.86)', borderRadius: radius.lg,
    paddingHorizontal: space.lg, paddingVertical: 13,
    ...type.body, color: colors.text,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  passwordRiga: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  occhio: {
    width: 46, height: 46, borderRadius: radius.lg, backgroundColor: 'rgba(18,18,22,0.86)',
    alignItems: 'center', justifyContent: 'center',
  },

  errore: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: 'rgba(255,69,58,0.12)', borderRadius: radius.lg, padding: space.md,
  },
  erroreTesto: { ...type.footnote, color: colors.text, flex: 1 },

  cta: { borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.accent },
  ctaOff: { backgroundColor: 'rgba(255,255,255,0.12)' },
  ctaTesto: { ...type.headline, color: colors.onAccent },
  ctaTestoOff: { color: colors.textFaint },
});
