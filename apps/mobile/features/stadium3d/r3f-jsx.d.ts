/*
 * Gli elementi 3D (<mesh>, <group>, ...) dentro il JSX dell'app.
 *
 * react-three-fiber li aggiunge da solo ai tipi di React, ma li aggiunge alla
 * copia di @types/react che trova accanto a se. Nel repository ce ne sono due
 * (19.2 per l'app, 19.3 arrivata con l'installazione fatta da Deno), e cosi i
 * 122 errori di tsc sullo stadio non erano errori del codice: gli elementi
 * finivano nella copia sbagliata. Qui si aggiungono a quella che usa l'app.
 */
import type { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
