import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

/**
 * Documento HTML dell'export web.
 *
 * Due cose qui contano piu del resto, e riguardano l'iPhone.
 *
 * 1. Aggiunta alla schermata Home, l'app parte a tutto schermo sotto la barra di
 *    stato. Le misure delle zone sicure arrivano solo da env(), che e CSS: si
 *    espongono come variabili cosi il codice puo leggerle.
 *
 * 2. Quando si apre la tastiera, su iOS la finestra NON si accorcia: si accorcia
 *    solo la parte visibile. Un'altezza fissata al 100% resta alta come prima e
 *    tutto quello che sta in fondo finisce sotto i tasti. Qui si misura la parte
 *    visibile e si tiene aggiornata un'altezza vera.
 */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#08080A" />
        <meta name="color-scheme" content="dark" />

        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icon-192.png" type="image/png" />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Tifo Daunia" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <meta
          name="description"
          content="App non ufficiale per i tifosi del Calcio Foggia 1920. Progetto indipendente, dati da fonti pubbliche."
        />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <script dangerouslySetInnerHTML={{ __html: VIEWPORT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const CSS = `
:root {
  --sat: env(safe-area-inset-top, 0px);
  --sar: env(safe-area-inset-right, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  /*
   * Altezza dell'app.
   *
   * Prima era un numero di pixel misurato all'avvio e riscritto a ogni resize.
   * Su iPhone, con l'app aggiunta alla schermata Home, quel numero restava piu
   * corto dello schermo e sotto avanzava una striscia nera inutilizzata, con la
   * barra delle schede sollevata di conseguenza.
   *
   * L'unita dvh fa da sola la cosa giusta: e l'altezza davvero disponibile, e
   * cambia quando le barre del browser compaiono o spariscono. I pixel misurati
   * servono ancora, ma solo con la tastiera aperta, dove dvh non basta.
   */
  --app-height: 100vh;
  --kb: 0px;
}
@supports (height: 100dvh) {
  :root { --app-height: 100dvh; }
}
html, body { height: 100%; background-color: #08080A; }
body {
  overscroll-behavior: none;
  -webkit-tap-highlight-color: transparent;
  /*
   * Toglie il ritardo di trecento millisecondi fra il tocco e la risposta.
   *
   * I browser aspettavano per capire se stesse arrivando un secondo tocco —
   * cioe un doppio tocco per ingrandire. In un'app dove si tocca di continuo
   * quel ritardo si sente su ogni singolo tasto: e la sensazione di "prima non
   * ha preso, poi e partito". Qui l'ingrandimento a doppio tocco non serve, e
   * il viewport lo esclude gia.
   */
  touch-action: manipulation;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
}

/*
 * Chi ha chiesto meno movimento nelle impostazioni del sistema lo ottiene anche
 * qui. Le animazioni scritte in JavaScript le spegne theme/motion.ts; questa
 * regola prende quelle che il browser fa per conto suo.
 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
#root {
  height: var(--app-height);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* la tastiera aperta non deve poter trascinare la pagina sotto la barra */
html[data-kb="open"], html[data-kb="open"] body { overflow: hidden; position: relative; }
`;

const VIEWPORT = `
(function () {
  var root = document.documentElement;
  var ultimaAltezza = -1;
  var ultimaTastiera = -1;
  var inCoda = false;

  function misura() {
    inCoda = false;
    var vv = window.visualViewport;
    var h = Math.round(vv ? vv.height : window.innerHeight);
    // quanto della finestra copre la tastiera: differenza fra la finestra e la
    // parte davvero visibile, tolto lo scorrimento della parte visibile stessa
    var kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;

    /*
     * QUI STAVA IL BUG DELLA TASTIERA CHE SI CHIUDE DA SOLA
     *
     * Su iPhone, mentre si scrive, il visualViewport manda 'scroll' in
     * continuazione: il browser insegue il cursore. Prima ogni evento
     * riscriveva --app-height e mandava un evento a React, quindi a ogni
     * lettera battuta l'intera app si rimisurava e si ridisegnava. Una
     * rimisurazione del contenitore mentre si scrive, su Safari, chiude la
     * tastiera.
     *
     * Adesso si scrive solo quando il numero e davvero cambiato di piu di un
     * punto, e al massimo una volta per fotogramma. Battere una lettera non
     * cambia l'altezza della finestra, quindi non succede piu niente.
     */
    var cambiata = Math.abs(h - ultimaAltezza) > 1 || Math.abs(kb - ultimaTastiera) > 1;
    if (!cambiata) return;
    ultimaAltezza = h;
    ultimaTastiera = kb;

    // con la tastiera aperta si comanda a mano, altrimenti vince dvh
    if (kb > 80) root.style.setProperty('--app-height', h + 'px');
    else root.style.removeProperty('--app-height');
    root.style.setProperty('--kb', kb + 'px');
    root.setAttribute('data-kb', kb > 80 ? 'open' : 'closed');
    window.dispatchEvent(new CustomEvent('appviewport', { detail: { height: h, keyboard: kb } }));
  }

  function apply() {
    if (inCoda) return;
    inCoda = true;
    requestAnimationFrame(misura);
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', apply);
    window.visualViewport.addEventListener('scroll', apply);
  }
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', function () { setTimeout(apply, 120); });

  /*
   * Con il contenitore ad altezza fissa iOS non porta da solo il campo attivo
   * sopra la tastiera: lo si fa qui, dopo che l'animazione dei tasti e finita.
   * Solo se serve davvero: uno scorrimento morbido su un campo gia visibile
   * fa partire altri eventi di viewport, che fanno scorrere ancora, e in mezzo
   * a quel rimbalzo la tastiera se ne va.
   */
  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (!el || !el.tagName) return;
    var t = el.tagName.toLowerCase();
    if (t !== 'input' && t !== 'textarea' && !el.isContentEditable) return;
    setTimeout(function () {
      if (!document.contains(el) || typeof el.getBoundingClientRect !== 'function') return;
      var r = el.getBoundingClientRect();
      var vv = window.visualViewport;
      var alto = vv ? vv.height : window.innerHeight;
      var fuori = r.top < 8 || r.bottom > alto - 8;
      if (fuori && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center' });
      }
    }, 320);
  });

  apply();
})();
`;
