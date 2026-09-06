import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image as RNImage, Modal, PanResponder, Platform, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { Premi } from './anima';
import { colors, radius, space, type } from '../theme/tokens';
import {
  calcolaRitaglio, limita, scalaMinima, vistaIniziale, type Sorgente, type Vista,
} from '../lib/ritaglio-core.ts';

const LATO = 260;
/** Lato finale dell'immagine salvata. Piu di cosi non serve a un cerchio. */
const USCITA = 512;

/**
 * Ritaglio dell'immagine del profilo.
 *
 * PERCHE ESISTE
 *
 * expo-image-picker sa gia ritagliare, ma solo sulle app native: sul web
 * `allowsEditing` non fa niente. Siccome oggi l'app si usa dal browser, chi
 * caricava una foto orizzontale se la vedeva schiacciata nel cerchio senza
 * poterci fare niente.
 *
 * E RISOLVE ANCHE IL LIMITE DEI 2 MB
 *
 * L'immagine esce da qui gia ridotta a 512 pixel di lato: un centinaio di
 * kilobyte invece dei quattro o cinque megabyte di una foto di telefono. Il
 * limite non lo si incontra piu, invece di alzarlo e spedire in giro file
 * enormi che poi rallentano l'app di chi guarda.
 *
 * I conti stanno in ritaglio-core.ts, senza React, sotto test.
 */
export function RitagliaAvatar({ uri, onFatto, onAnnulla }: {
  uri: string;
  onFatto: (b: Blob) => void;
  onAnnulla: () => void;
}) {
  const [img, setImg] = useState<Sorgente | null>(null);
  const [vista, setVista] = useState<Vista>({ zoom: 1, x: 0, y: 0 });
  const [inCorso, setInCorso] = useState(false);
  const partenza = useRef<Vista>({ zoom: 1, x: 0, y: 0 });

  useEffect(() => {
    RNImage.getSize(
      uri,
      (larghezza, altezza) => {
        const s = { larghezza, altezza };
        setImg(s);
        setVista(vistaIniziale(s, LATO));
      },
      () => setImg({ larghezza: LATO, altezza: LATO }),
    );
  }, [uri]);

  const trascina = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { partenza.current = vista; },
    onPanResponderMove: (_e, g) => {
      if (!img) return;
      setVista(limita(img, LATO, {
        zoom: partenza.current.zoom,
        x: partenza.current.x + g.dx,
        y: partenza.current.y + g.dy,
      }));
    },
  }), [img, vista]);

  const zooma = (delta: number) => {
    if (!img) return;
    setVista((v) => {
      // si ingrandisce attorno al centro del riquadro, non all'angolo:
      // altrimenti la faccia scappa via mentre si preme il piu
      const prima = scalaMinima(img, LATO) * v.zoom;
      const dopo = scalaMinima(img, LATO) * Math.max(1, Math.min(6, v.zoom + delta));
      const k = dopo / prima;
      return limita(img, LATO, {
        zoom: v.zoom + delta,
        x: LATO / 2 - (LATO / 2 - v.x) * k,
        y: LATO / 2 - (LATO / 2 - v.y) * k,
      });
    });
  };

  const conferma = async () => {
    if (!img || Platform.OS !== 'web') return;
    setInCorso(true);
    try {
      const r = calcolaRitaglio(img, LATO, vista);
      const sorgente = await caricaImmagine(uri);
      const tela = document.createElement('canvas');
      tela.width = USCITA;
      tela.height = USCITA;
      const ctx = tela.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sorgente, r.sx, r.sy, r.lato, r.lato, 0, 0, USCITA, USCITA);
      const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', 0.85));
      if (blob) onFatto(blob);
    } finally {
      setInCorso(false);
    }
  };

  const s = img ? scalaMinima(img, LATO) * vista.zoom : 1;

  return (
    <Modal transparent animationType="fade" onRequestClose={onAnnulla}>
      <View style={styles.fondo}>
        <View style={styles.scheda}>
          <Text style={styles.titolo}>Sistema la foto</Text>
          <Text style={styles.sotto}>Trascina per spostarla, i pulsanti per ingrandirla.</Text>

          <View style={styles.riquadro} {...trascina.panHandlers}>
            {img ? (
              <Image
                source={{ uri }}
                style={{
                  position: 'absolute',
                  left: vista.x,
                  top: vista.y,
                  width: img.larghezza * s,
                  height: img.altezza * s,
                }}
                contentFit="fill"
              />
            ) : null}
            {/* il cerchio e solo una maschera sopra: l'immagine sotto resta intera */}
            <View pointerEvents="none" style={styles.maschera} />
          </View>

          <View style={styles.zoom}>
            <Premi onPress={() => zooma(-0.25)}>
              <View style={styles.tastoZoom}><Ionicons name="remove" size={20} color={colors.text} /></View>
            </Premi>
            <View style={styles.barra}>
              <View style={[styles.barraPiena, { width: `${((vista.zoom - 1) / 5) * 100}%` }]} />
            </View>
            <Premi onPress={() => zooma(0.25)}>
              <View style={styles.tastoZoom}><Ionicons name="add" size={20} color={colors.text} /></View>
            </Premi>
          </View>

          <View style={styles.azioni}>
            <Premi onPress={onAnnulla}>
              <View style={[styles.tasto, styles.tastoScuro]}><Text style={styles.tastoTesto}>Annulla</Text></View>
            </Premi>
            <Premi onPress={conferma} disabled={!img || inCorso}>
              <View style={[styles.tasto, styles.tastoRosso]}>
                <Text style={[styles.tastoTesto, { color: colors.onAccent }]}>
                  {inCorso ? 'Un momento…' : 'Usa questa'}
                </Text>
              </View>
            </Premi>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function caricaImmagine(uri: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const i = new window.Image();
    // serve per poter leggere i pixel di un'immagine che arriva da un altro
    // indirizzo, altrimenti la tela si "sporca" e toBlob smette di funzionare
    i.crossOrigin = 'anonymous';
    i.onload = () => ok(i);
    i.onerror = ko;
    i.src = uri;
  });
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  scheda: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md, alignItems: 'center', maxWidth: 340 },
  titolo: { ...type.title3, color: colors.text },
  sotto: { ...type.caption, color: colors.textDim, textAlign: 'center' },
  riquadro: { width: LATO, height: LATO, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  maschera: {
    position: 'absolute', left: 0, top: 0, width: LATO, height: LATO,
    borderRadius: LATO / 2,
    borderWidth: 999, borderColor: 'rgba(0,0,0,0.55)',
  },
  zoom: { flexDirection: 'row', alignItems: 'center', gap: space.md, width: '100%' },
  tastoZoom: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  barra: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  barraPiena: { height: 4, backgroundColor: colors.accentBright },
  azioni: { flexDirection: 'row', gap: space.sm, width: '100%' },
  tasto: { flex: 1, borderRadius: radius.lg, paddingVertical: 13, alignItems: 'center', minWidth: 130 },
  tastoScuro: { backgroundColor: colors.surfaceHi },
  tastoRosso: { backgroundColor: colors.accent },
  tastoTesto: { ...type.headline, color: colors.text },
});
