import { Tabs } from 'expo-router';

import { FloatingTabBar } from '../../components/FloatingTabBar';

/**
 * Le schede usano una barra propria, galleggiante e arrotondata: quella di
 * sistema resta ancorata al bordo e non si puo staccare.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/*
        * Sei voci, non sette: su uno schermo da 360 punti la settima toglie
        * spazio alle etichette, e una barra di icone mute e la cosa piu
        * difficile da capire che si possa mettere in un'app.
        *
        * La Rosa e uscita dalla barra ed e nelle scorciatoie in home: si guarda
        * ogni tanto, non ogni giorno. Le Trasferte sono entrate perche
        * rispondono a una domanda che ci si fa tutte le settimane.
        */}
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="matches" options={{ title: 'Partite' }} />
      <Tabs.Screen name="trasferte" options={{ title: 'Trasferte' }} />
      <Tabs.Screen name="curva" options={{ title: 'Curva' }} />
      <Tabs.Screen name="stadium" options={{ title: 'Stadio' }} />
      <Tabs.Screen name="news" options={{ title: 'News' }} />
      <Tabs.Screen name="squad" options={{ href: null }} />
    </Tabs>
  );
}
