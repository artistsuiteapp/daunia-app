import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';


/**
 * Documento HTML dell'export web.
 *
 * Nella build condivisa il link va a un gruppo di persone, non al pubblico:
 * noindex/nofollow tiene la pagina fuori dai motori di ricerca, che e la
 * differenza tra "lo vedono i miei amici" e "lo trova chi cerca Foggia calcio".
 */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#08080A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta
          name="description"
          content="App non ufficiale per i tifosi del Calcio Foggia 1920. Progetto indipendente, dati da fonti pubbliche."
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BODY }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BODY = `
body { background-color: #08080A; overscroll-behavior: none; }
`;
