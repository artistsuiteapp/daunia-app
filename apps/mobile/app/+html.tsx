import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

const IS_PREVIEW = process.env.EXPO_PUBLIC_PREVIEW === '1';

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
        {IS_PREVIEW ? (
          <>
            <meta name="robots" content="noindex, nofollow, noarchive, noimageindex" />
            <meta name="googlebot" content="noindex, nofollow" />
            <meta name="referrer" content="no-referrer" />
          </>
        ) : null}
        <meta name="theme-color" content="#08080A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta
          name="description"
          content="Prototipo di app per i tifosi. Non ufficiale, non affiliato al Calcio Foggia 1920."
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
