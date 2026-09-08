/**
 * Aprire un articolo di una testata.
 *
 * Non e una WebView nostra: `openBrowserAsync` usa SFSafariViewController su
 * iOS e le Custom Tabs su Android, cioe il browser di sistema montato dentro
 * l'app. Girano i loro script, i loro banner e i loro cookie — condivisi con
 * Safari e Chrome — quindi per la testata resta una visita normale, con la sua
 * pubblicita e le sue statistiche. E anche la via che Apple e Google indicano:
 * una WebView che ripulisce la pagina sarebbe un problema con le redazioni
 * prima ancora che con i negozi.
 *
 * Il vantaggio per chi legge e non perdere il posto: si chiude e si torna
 * esattamente dov'era, invece di rimbalzare fuori e dover riaprire l'app.
 */
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import { colors } from '../theme/tokens';

export async function apriArticolo(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      toolbarColor: colors.bgElevated,
      controlsColor: colors.accentBright,
      enableBarCollapsing: true,
      showTitle: true,
    });
  } catch {
    // se il browser interno non parte, meglio uscire che non aprire niente
    await Linking.openURL(url).catch(() => {});
  }
}
