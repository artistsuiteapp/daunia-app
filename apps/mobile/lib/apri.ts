/**
 * Aprire una pagina fuori dall'app.
 *
 * Tutto passa da qui e da `apriFuori`: `Linking.openURL` sparso per le
 * schermate era il modo per dimenticarsi il controllo su un indirizzo che
 * arriva dal bundle scaricato o da Supabase.
 *
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
import { apribile } from './apri-core.ts';

export async function apriArticolo(url: string): Promise<void> {
  /*
   * Il controllo sta prima di tutto, ripiego compreso.
   *
   * `openBrowserAsync` rifiuta da solo gli schemi non web, ma il catch qui
   * sotto cadeva su `Linking.openURL`, che invece li consegna a chi li ha
   * registrati: il ramo d'emergenza era piu permissivo di quello normale.
   */
  if (!apribile(url)) return;
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

/**
 * Apre una pagina fuori dall’app: biglietti, referto, fonte di una notizia.
 *
 * Come apriArticolo ma senza il browser interno, per i casi in cui uscire e'
 * quello che serve. Un indirizzo che non e' una pagina web non viene aperto e
 * non da errore: non c’e niente di utile da dire a chi tocca il tasto, e un
 * avviso lo spingerebbe solo a riprovare.
 */
export async function apriFuori(url: unknown): Promise<void> {
  if (!apribile(url)) return;
  await Linking.openURL(url).catch(() => {});
}
