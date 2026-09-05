import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';

import { colors } from '../theme/tokens';
import { AppShell } from '../components/AppShell';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // il testo dell'interfaccia usa il carattere di sistema: si carica solo la
  // condensata, che serve a punteggi e contatori
  const [loaded, error] = useFonts({
    BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold,
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
            animation: 'slide_from_right',
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
          <Stack.Screen name="tickets" />
          </Stack>
        </AppShell>
    </SafeAreaProvider>
  );
}
