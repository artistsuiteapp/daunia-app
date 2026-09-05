import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * L'app nasce per il telefono. Su browser viene mostrata dentro una cornice
 * (vedi components/AppShell.tsx): il layout deve misurarsi su quella cornice,
 * non sulla finestra, altrimenti userebbe il layout da schermo largo dentro
 * una colonna stretta. Da qui il contesto: chi disegna la cornice dichiara le
 * dimensioni vere dell'area utile.
 */
export type Breakpoint = 'phone' | 'tablet' | 'desktop';

const PHONE_MAX = 600;
const TABLET_MAX = 1024;

export const CONTENT_MAX_WIDTH = 640;

type Viewport = { width: number; height: number } | null;

export const ViewportContext = createContext<Viewport>(null);

export function useLayout() {
  const window = useWindowDimensions();
  const framed = useContext(ViewportContext);
  const width = framed?.width ?? window.width;
  const height = framed?.height ?? window.height;

  const bp: Breakpoint = width < PHONE_MAX ? 'phone' : width < TABLET_MAX ? 'tablet' : 'desktop';
  const content = Math.min(width, CONTENT_MAX_WIDTH);

  return {
    width,
    height,
    bp,
    isPhone: bp === 'phone',
    isWide: bp !== 'phone',
    /** larghezza utile del contenuto, gia limitata */
    content,
    /** margine orizzontale che centra il contenuto sugli schermi larghi */
    gutter: Math.max(0, (width - content) / 2),
    /** colonne per le griglie: 3 sul telefono, 4 o 6 sugli schermi larghi */
    columns: bp === 'phone' ? 3 : bp === 'tablet' ? 4 : 6,
    /** scala tipografica: i titoli crescono un po' sugli schermi grandi */
    scale: (base: number, max = base * 1.35) =>
      Math.round(Math.min(max, base * (0.9 + Math.min(width, 900) / 1400))),
  };
}
