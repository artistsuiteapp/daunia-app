import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold,
  Montserrat_700Bold, Montserrat_700Bold_Italic,
  Montserrat_800ExtraBold, Montserrat_800ExtraBold_Italic,
} from '@expo-google-fonts/montserrat';

import { colors } from '../theme/tokens';
import { durata } from '../theme/motion';
import { AppShell } from '../components/AppShell';
import { useDatiFreschi } from '../lib/bundle-remoto';
import { entraDaCollegamento, quandoRecupero } from '../lib/auth';
import { parametriRecupero } from '../lib/recupero-core';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  /*
   * Scarica calendario, classifica, rosa e comunicati e li sostituisce a caldo.
   * Va qui perche lo scaricamento deve partire una volta sola per tutta l'app.
   *
   * Il ridisegno pero non passa di qui: se ne occupa `useDati()` dentro Screen.
   * Contare su questo stato per far ridisegnare le schermate non funziona --
   * i navigatori memorizzano le scene apposta.
   */
  useDatiFreschi();

  // chi entra da un collegamento di recupero finisce dove si sceglie la password
  useEffect(() => quandoRecupero(() => router.replace('/nuova-password' as never)), []);

  /*
   * I collegamenti delle email, sul telefono.
   *
   * Conferma dell'iscrizione e recupero password tornano come
   * `daunia://accedi#access_token=...` o `daunia://nuova-password#...`. Sul web
   * li legge supabase-js; qui nessuno li guardava. Si leggono in un posto solo,
   * perche lo stesso token usato due volte la seconda volta fallisce.
   */
  const indirizzo = Linking.useURL();
  const letto = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web' || !indirizzo || letto.current === indirizzo) return;
    const p = parametriRecupero(indirizzo);
    if (!p.accesso && !p.codice && !p.errore) return;
    letto.current = indirizzo;
    const recupero = p.tipo === 'recovery' || indirizzo.includes('nuova-password');
    void entraDaCollegamento(indirizzo).then((r) => {
      const errore = r.errore ? `?errore=${encodeURIComponent(r.errore)}` : '';
      if (recupero) router.replace(`/nuova-password${errore}` as never);
      else router.replace((r.errore ? `/accedi${errore}` : '/') as never);
    });
  }, [indirizzo]);

  // Montserrat regge tutta l'interfaccia: i pesi bassi per il corpo, i corsivi
  // pesanti per numeri e titoli, come nella scritta del logo
  const [loaded, error] = useFonts({
    Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold,
    Montserrat_700Bold, Montserrat_700Bold_Italic,
    Montserrat_800ExtraBold, Montserrat_800ExtraBold_Italic,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
        <AppShell>
          <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            /*
             * Duecentosessanta millisecondi, gli stessi di theme/motion.ts.
             * Il valore di serie e piu lungo e su web fa sembrare ogni
             * passaggio una cosa che deve finire prima di poter toccare
             * qualcosa.
             */
            animation: 'slide_from_right',
            animationDuration: durata.media,
            gestureEnabled: true,
            animationTypeForReplace: 'push',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="match/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="player/[id]" />
          <Stack.Screen name="post/[slug]" />
          <Stack.Screen name="curva/[id]" />
          <Stack.Screen name="curva/nuovo" options={{ presentation: 'modal' }} />
          <Stack.Screen name="standings" />
          <Stack.Screen name="stats" />
          <Stack.Screen name="pronostici" />
          <Stack.Screen name="condizioni" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="profilo" />
          <Stack.Screen name="utente/[id]" />
          <Stack.Screen name="admin/index" />
          <Stack.Screen name="admin/utenti" />
          <Stack.Screen name="admin/online" />
          <Stack.Screen name="admin/numeri" />
          <Stack.Screen name="accedi" />
          <Stack.Screen name="benvenuto" options={{ animation: 'fade' }} />
          <Stack.Screen name="tickets" />
          </Stack>
        </AppShell>
    </SafeAreaProvider>
  );
}
