import { useEffect } from 'react';
import { Stack } from 'expo-router';
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
import { AppShell } from '../components/AppShell';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
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
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="match/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="player/[id]" />
          <Stack.Screen name="post/[slug]" />
          <Stack.Screen name="curva/[id]" />
          <Stack.Screen name="curva/stanza/[room]" />
          <Stack.Screen name="curva/nuovo" options={{ presentation: 'modal' }} />
          <Stack.Screen name="standings" />
          <Stack.Screen name="stats" />
          <Stack.Screen name="tickets" />
          </Stack>
        </AppShell>
    </SafeAreaProvider>
  );
}
