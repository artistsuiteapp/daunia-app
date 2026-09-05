import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useGutter } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { BrandMark } from '../components/BrandMark';
import { colors, radius, space, type } from '../theme/tokens';
import { accedi, recuperaPassword, registrati, validaRegistrazione } from '../lib/auth';
import { backendAttivo } from '../lib/supabase';

type Modo = 'accesso' | 'registrazione' | 'recupero';

/**
 * Accesso, registrazione e recupero in una schermata sola.
 *
 * Tre moduli separati costringerebbero a tornare indietro per cambiare idea, e
 * chi sbaglia la password vuole solo passare al recupero senza perdere quello
 * che ha gia scritto. Qui l'indirizzo email resta al suo posto quando si cambia
 * modalita.
 */
export default function Accedi() {
  const gutter = useGutter();
  const [modo, setModo] = useState<Modo>('accesso');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostraPassword, setMostraPassword] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const pronto = modo === 'registrazione'
    ? validaRegistrazione(nome, email, password) === null
    : modo === 'recupero'
      ? email.trim().length > 3
      : email.trim().length > 3 && password.length > 0;

  const invia = async () => {
    setErrore(null); setAvviso(null); setInCorso(true);
    try {
      if (modo === 'registrazione') {
        const r = await registrati(nome, email, password);
        if (r.errore) return setErrore(r.errore);
        if (r.confermaRichiesta) {
          setAvviso('Ti abbiamo mandato una email. Aprila e conferma per finire.');
          return;
        }
        router.replace('/profilo' as never);
      } else if (modo === 'recupero') {
        const r = await recuperaPassword(email, 'https://daunia.vercel.app/accedi');
        if (r.errore) return setErrore(r.errore);
        // non si dice mai se l'indirizzo esiste: sarebbe un modo per scoprire
        // chi e iscritto
        setAvviso('Se quell’indirizzo è registrato, ti arriva una email con le istruzioni.');
      } else {
        const r = await accedi(email, password);
        if (r.errore) return setErrore(r.errore);
        router.back();
      }
    } finally {
      setInCorso(false);
    }
  };

  if (!backendAttivo) {
    return (
      <Screen>
        <BackBar label="Indietro" />
        <View style={[styles.wrap, gutter]}>
          <BrandMark size={64} />
          <Text style={styles.titolo}>Iscrizioni non ancora aperte</Text>
          <Text style={styles.testo}>
            Gli account arrivano quando la raccolta fondi copre le tutele per chi si iscrive.
            Intanto puoi usare tutto: quello che scrivi resta su questo dispositivo.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackBar label="Indietro" />

      <View style={[styles.wrap, gutter]}>
        <BrandMark size={56} />
        <Text style={styles.titolo}>
          {modo === 'accesso' ? 'Bentornato' : modo === 'registrazione' ? 'Unisciti alla Curva' : 'Recupera la password'}
        </Text>
        <Text style={styles.testo}>
          {modo === 'recupero'
            ? 'Scrivi il tuo indirizzo e ti mandiamo il collegamento per cambiarla.'
            : 'Serve solo per scrivere nella Curva e tenere i tuoi voti fra un dispositivo e l’altro.'}
        </Text>

        {modo === 'registrazione' ? (
          <Campo etichetta="Come ti chiami">
            <TextInput
              value={nome} onChangeText={setNome}
              placeholder="Il nome che vedranno gli altri"
              placeholderTextColor={colors.textFaint}
              style={styles.input} maxLength={40} autoCapitalize="words"
            />
          </Campo>
        ) : null}

        <Campo etichetta="Email">
          <TextInput
            value={email} onChangeText={setEmail}
            placeholder="tu@esempio.it"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCapitalize="none" keyboardType="email-address"
            autoComplete="email" textContentType="emailAddress"
          />
        </Campo>

        {modo !== 'recupero' ? (
          <Campo etichetta={modo === 'registrazione' ? 'Password, almeno 8 caratteri' : 'Password'}>
            <View style={styles.passwordRiga}>
              <TextInput
                value={password} onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
                style={[styles.input, { flex: 1 }]}
                secureTextEntry={!mostraPassword}
                autoCapitalize="none"
                autoComplete={modo === 'registrazione' ? 'new-password' : 'current-password'}
                textContentType={modo === 'registrazione' ? 'newPassword' : 'password'}
              />
              <Pressable onPress={() => setMostraPassword((v) => !v)} hitSlop={10} style={styles.occhio}>
                <Ionicons name={mostraPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.textDim} />
              </Pressable>
            </View>
          </Campo>
        ) : null}

        {errore ? (
          <View style={styles.errore}>
            <Ionicons name="alert-circle" size={16} color={colors.loss} />
            <Text style={styles.erroreTesto}>{errore}</Text>
          </View>
        ) : null}

        {avviso ? (
          <View style={styles.avviso}>
            <Ionicons name="mail-outline" size={16} color={colors.win} />
            <Text style={styles.avvisoTesto}>{avviso}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={invia}
          disabled={!pronto || inCorso}
          style={({ pressed }) => [styles.cta, (!pronto || inCorso) && styles.ctaOff, pressed && { opacity: 0.85 }]}
        >
          <Text style={[styles.ctaTesto, (!pronto || inCorso) && styles.ctaTestoOff]}>
            {inCorso ? 'Un momento…'
              : modo === 'accesso' ? 'Entra'
              : modo === 'registrazione' ? 'Crea l’account'
              : 'Mandami il collegamento'}
          </Text>
        </Pressable>

        {modo === 'registrazione' ? (
          <Text style={styles.legale}>
            Creando l’account accetti le{' '}
            <Text style={styles.link} onPress={() => router.push('/condizioni' as never)}>condizioni d’uso</Text>
            {' '}e hai letto l’
            <Text style={styles.link} onPress={() => router.push('/privacy' as never)}>informativa privacy</Text>.
            Raccogliamo email e nome, niente altro che tu non scriva.
          </Text>
        ) : null}

        <View style={styles.scelte}>
          {modo !== 'accesso' ? (
            <Pressable onPress={() => { setModo('accesso'); setErrore(null); setAvviso(null); }}>
              <Text style={styles.scelta}>Ho già un account</Text>
            </Pressable>
          ) : null}
          {modo !== 'registrazione' ? (
            <Pressable onPress={() => { setModo('registrazione'); setErrore(null); setAvviso(null); }}>
              <Text style={styles.scelta}>Non ho un account</Text>
            </Pressable>
          ) : null}
          {modo !== 'recupero' ? (
            <Pressable onPress={() => { setModo('recupero'); setErrore(null); setAvviso(null); }}>
              <Text style={styles.scelta}>Password dimenticata</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function Campo({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etichetta}>{etichetta.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, marginTop: space.lg, alignItems: 'stretch' },
  titolo: { ...type.displayTitle, color: colors.text },
  testo: { ...type.subhead, color: colors.textDim, lineHeight: 21, marginTop: -space.sm },

  campo: { gap: space.sm },
  etichetta: { ...type.caption, color: colors.textFaint, letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: space.lg, paddingVertical: 13,
    ...type.body, color: colors.text,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  passwordRiga: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  occhio: {
    width: 46, height: 46, borderRadius: radius.lg, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  errore: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: 'rgba(255,69,58,0.12)', borderRadius: radius.lg, padding: space.md,
  },
  erroreTesto: { ...type.footnote, color: colors.text, flex: 1 },
  avviso: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: 'rgba(48,209,88,0.12)', borderRadius: radius.lg, padding: space.md,
  },
  avvisoTesto: { ...type.footnote, color: colors.text, flex: 1 },

  cta: { borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.accent },
  ctaOff: { backgroundColor: colors.surface },
  ctaTesto: { ...type.headline, color: colors.onAccent },
  ctaTestoOff: { color: colors.textFaint },

  legale: { ...type.caption, color: colors.textFaint, lineHeight: 17 },
  link: { color: colors.accentBright },

  scelte: { gap: space.md, marginTop: space.sm },
  scelta: { ...type.subheadBold, color: colors.accentBright },
});
