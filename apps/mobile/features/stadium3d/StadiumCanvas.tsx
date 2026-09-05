import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import type { Stadium, StadiumSector } from '@satanelli/core';

import { Canvas, useFrame, useThree } from './r3f';
import { buildSectorMesh } from './geometry';
import { buildSeating, CONCRETE, CONCRETE_DARK, type SeatMode } from './seating';
import { Pitch } from './Pitch';
import { Floodlights, LedBoards } from './Floodlights';

type Props = {
  stadium: Stadium;
  selectedId: string | null;
  onSelect: (sector: StadiumSector) => void;
  mode: SeatMode;
  /** quota di riempimento per settore, da 0 a 1 */
  fill?: Record<string, number>;
};

/** Stato della camera in coordinate sferiche, condiviso fra i gesti e il render loop. */
type Orbit = { azimuth: number; polar: number; distance: number; fitted?: boolean };

export function StadiumCanvas({ stadium, selectedId, onSelect, mode, fill }: Props) {
  // camera sopra la Tribuna Centrale, che guarda dall'altra parte: e il punto di
  // vista delle foto aeree, ed e l'unico da cui la scritta sulla gradinata di
  // fronte si legge nel verso giusto
  const orbit = useRef<Orbit>({ azimuth: -Math.PI * 0.43, polar: 0.6, distance: 250 });
  /**
   * Il canvas gira in frameloop "demand": disegna solo quando qualcosa cambia.
   * Una mappa dello stadio e ferma per la maggior parte del tempo, e su un telefono
   * un ciclo a 60fps costante si mangia la batteria per niente.
   */
  const requestFrame = useRef<(() => void) | null>(null);
  const draw = () => requestFrame.current?.();
  const pinchRef = useRef<number | null>(null);
  /** ultimo spostamento cumulativo visto, per ricavare il delta fra due eventi */
  const last = useRef({ x: 0, y: 0 });
  /** quanto si e mosso il dito nel gesto in corso: sotto soglia e un tocco, non un trascinamento */
  const travelled = useRef(0);
  const size = useRef({ w: 1, h: 1 });
  /** funzione di selezione fornita dall'interno del Canvas, dove vivono camera e scena */
  const pick = useRef<((nx: number, ny: number) => StadiumSector | null) | null>(null);
  /**
   * Distanza minima e massima della camera, calcolate sull'ingombro vero della
   * scena: cosi lo stadio resta sempre tutto dentro l'inquadratura, comunque lo
   * si ruoti o zoomi.
   */
  const zoom = useRef({ min: 150, max: 320 });

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          last.current = { x: 0, y: 0 };
          travelled.current = 0;
          pinchRef.current = null;
        },
        onPanResponderMove: (evt, g) => {
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2) {
            const [a, b] = touches;
            const d = Math.hypot(a!.pageX - b!.pageX, a!.pageY - b!.pageY);
            const prev = pinchRef.current;
            if (prev) orbit.current.distance = clamp(orbit.current.distance * (prev / d), zoom.current.min, zoom.current.max);
            pinchRef.current = d;
            travelled.current += 20;
            draw();
            return;
          }
          pinchRef.current = null;

          // dx e dy sono lo spostamento TOTALE dall'inizio del gesto, non il delta
          // rispetto all'evento precedente: usarli come delta faceva accelerare la
          // rotazione a ogni frame, ed era il motivo per cui lo stadio schizzava via
          const dx = g.dx - last.current.x;
          const dy = g.dy - last.current.y;
          last.current = { x: g.dx, y: g.dy };
          travelled.current += Math.abs(dx) + Math.abs(dy);

          orbit.current.azimuth -= dx * 0.0055;
          orbit.current.polar = clamp(orbit.current.polar - dy * 0.004, 0.18, 1.34);
          draw();
        },
        onPanResponderRelease: (evt) => {
          pinchRef.current = null;
          // sotto la soglia il gesto e un tocco: si seleziona il settore sotto al dito.
          // Il click di react-three-fiber non arriverebbe mai, perche questa vista
          // cattura il tocco prima del canvas.
          if (travelled.current < 9 && pick.current) {
            const { locationX, locationY } = evt.nativeEvent;
            const nx = (locationX / size.current.w) * 2 - 1;
            const ny = -(locationY / size.current.h) * 2 + 1;
            const hit = pick.current(nx, ny);
            if (hit) onSelect(hit);
          }
          draw();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [onSelect],
  );

  const sectors = useMemo(
    () => stadium.sectors.map((s) => ({
      sector: s,
      shell: buildSectorMesh(s),
      seats: buildSeating(s, mode, fill?.[s.id] ?? 1),
    })),
    [stadium, mode, fill],
  );

  const covered = stadium.sectors.find((s) => s.covered);
  const standTop = covered ? covered.geometry.topHeight + 6 : 20;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => { size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}
      {...pan.panHandlers}
    >
      <Canvas
        frameloop="demand"
        gl={{ antialias: true }}
        camera={{ fov: 40, near: 1, far: 3000, position: [0, 200, -150] }}
        onCreated={(state: { gl: THREE.WebGLRenderer; scene: THREE.Scene }) => {
          state.gl.setClearColor('#070709');
          state.scene.fog = new THREE.Fog('#070709', 340, 760);
        }}
      >
        <OrbitCamera orbit={orbit} requestFrame={requestFrame} zoom={zoom} />
        <Picker pickRef={pick} />
        <Framing orbit={orbit} zoom={zoom} requestFrame={requestFrame} />

        {/* notte allo stadio: base fredda, riempimento caldo dai proiettori */}
        <ambientLight intensity={0.78} color="#a9b8d4" />
        <hemisphereLight args={['#9ab0d4', '#332e26', 0.95]} />
        <directionalLight position={[140, 230, -120]} intensity={1.45} color="#fff4dc" />
        <directionalLight position={[-170, 190, 150]} intensity={0.9} color="#d4e2ff" />
        <directionalLight position={[0, 120, 0]} intensity={0.5} color="#ffffff" />

        <Pitch length={stadium.pitch.length} width={stadium.pitch.width} />
        <LedBoards length={stadium.pitch.length} width={stadium.pitch.width} />

        {sectors.map(({ sector, shell, seats }) => {
          const selected = sector.id === selectedId;
          return (
            <group key={sector.id} position={shell.position} rotation={shell.rotation}>
              {/* struttura in cemento */}
              <mesh geometry={shell.geometry} userData={{ sector }}>
                <meshStandardMaterial
                  color={selected ? '#8d5b57' : CONCRETE}
                  roughness={0.95}
                  metalness={0}
                />
              </mesh>
              {/* seggiolini */}
              <mesh geometry={seats.geometry} userData={{ sector }}>
                <meshStandardMaterial
                  vertexColors
                  color={selected ? '#ff8f88' : '#ffffff'}
                  roughness={0.82}
                  metalness={0.02}
                  side={THREE.DoubleSide}
                  emissive={selected ? '#5a0d10' : '#000000'}
                  emissiveIntensity={selected ? 0.55 : 0}
                />
              </mesh>
            </group>
          );
        })}

        <Structures stadium={stadium} />
        <Floodlights
          pitchLength={stadium.pitch.length}
          pitchWidth={stadium.pitch.width}
          standTop={standTop}
        />
      </Canvas>
    </View>
  );
}

/**
 * Espone all'esterno del Canvas una funzione che, date coordinate normalizzate,
 * dice quale settore sta sotto. Camera, raycaster e scena vivono solo qui dentro.
 */
function Picker({ pickRef }: {
  pickRef: React.MutableRefObject<((nx: number, ny: number) => StadiumSector | null) | null>;
}) {
  const camera = useThree((s) => s.camera);
  const raycaster = useThree((s) => s.raycaster);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    pickRef.current = (nx, ny) => {
      raycaster.setFromCamera({ x: nx, y: ny } as THREE.Vector2, camera);
      const targets: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && (o.userData as { sector?: StadiumSector }).sector) targets.push(o);
      });
      const hit = raycaster.intersectObjects(targets, false)[0];
      return hit ? ((hit.object.userData as { sector: StadiumSector }).sector) : null;
    };
    return () => { pickRef.current = null; };
  }, [camera, raycaster, scene, pickRef]);

  return null;
}

/**
 * Tiene lo stadio sempre tutto in quadro.
 *
 * Misura l'ingombro della scena, ne ricava la sfera che la contiene e calcola la
 * distanza a cui quella sfera riempie l'inquadratura, tenendo conto sia
 * dell'apertura verticale sia di quella orizzontale: su uno schermo stretto e
 * l'orizzontale a comandare. Da li nascono i limiti dello zoom, ricalcolati
 * quando cambiano le proporzioni della vista.
 */
function Framing({ orbit, zoom, requestFrame }: {
  orbit: React.MutableRefObject<Orbit>;
  zoom: React.MutableRefObject<{ min: number; max: number }>;
  requestFrame: React.MutableRefObject<(() => void) | null>;
}) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  useEffect(() => {
    // si misura solo la vasca (gradinate e campo), non i pali dei fari ne il
    // piazzale: includerli allargava la sfera di quasi il doppio e lo stadio
    // finiva minuscolo in mezzo allo schermo
    const box = new THREE.Box3();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const isSector = Boolean((o.userData as { sector?: unknown }).sector);
      const isPitch = m.geometry?.type === 'PlaneGeometry';
      if (isSector || isPitch) box.expandByObject(m);
    });
    if (box.isEmpty()) box.setFromObject(scene);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = sphere.radius;

    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    // la distanza che serve e la piu grande fra le due: se basta per il lato
    // stretto, basta anche per l'altro
    const needed = Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2));

    // la vasca riempie l'inquadratura, con appena un margine
    const fit = needed * 0.74;
    zoom.current = { min: fit * 0.7, max: fit * 1.35 };
    orbit.current.distance = Math.min(Math.max(orbit.current.distance, zoom.current.min), zoom.current.max);
    if (!orbit.current.fitted) {
      orbit.current.distance = fit;
      orbit.current.fitted = true;
    }
    requestFrame.current?.();
  }, [scene, camera, size.width, size.height, orbit, zoom, requestFrame]);

  return null;
}

function OrbitCamera({ orbit, requestFrame, zoom }: {
  orbit: React.MutableRefObject<Orbit>;
  requestFrame: React.MutableRefObject<(() => void) | null>;
  zoom: React.MutableRefObject<{ min: number; max: number }>;
}) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const three = useThree();

  useEffect(() => {
    requestFrame.current = invalidate;
    invalidate();
    if (__DEV__ && typeof globalThis !== 'undefined') (globalThis as { __r3f?: unknown }).__r3f = three;
    return () => { requestFrame.current = null; };
  }, [invalidate, requestFrame, three]);

  useFrame(() => {
    const { azimuth, polar } = orbit.current;
    const distance = clamp(orbit.current.distance, zoom.current.min, zoom.current.max);
    orbit.current.distance = distance;
    camera.position.set(
      distance * Math.sin(polar) * Math.cos(azimuth),
      distance * Math.cos(polar),
      distance * Math.sin(polar) * Math.sin(azimuth),
    );
    camera.lookAt(0, 6, 0);
  });
  return null;
}

/** Tetto della Tribuna Centrale e muro perimetrale esterno. */
function Structures({ stadium }: { stadium: Stadium }) {
  const covered = stadium.sectors.find((s) => s.covered);
  const outer = Math.max(
    ...stadium.sectors.map((s) => s.geometry.offset + s.geometry.depth),
  );

  return (
    <group>
      {covered ? <Roof sector={covered} /> : null}

      {/* piazzale attorno allo stadio: scuro, serve solo a chiudere la vasca */}
      <mesh position={[0, -1.4, 0]}>
        <boxGeometry args={[outer * 2 + 4, 2.6, outer * 2 + 4]} />
        <meshStandardMaterial color="#191713" roughness={1} />
      </mesh>
    </group>
  );
}

function Roof({ sector }: { sector: StadiumSector }) {
  const { length, depth, offset, topHeight } = sector.geometry;
  const z = sector.side === 'west' ? -(offset + depth * 0.55) : offset + depth * 0.55;
  const h = topHeight + 6.5;
  return (
    <group>
      <mesh position={[0, h, z]}>
        <boxGeometry args={[length + 6, 1.1, depth * 1.05]} />
        <meshStandardMaterial color="#565349" roughness={0.75} metalness={0.15} />
      </mesh>
      {/* pilastri di sostegno sul fondo della tribuna */}
      {[-1, -0.34, 0.34, 1].map((f) => (
        <mesh key={f} position={[f * (length / 2 - 5), h / 2, z - depth * 0.42]}>
          <boxGeometry args={[1.3, h, 1.3]} />
          <meshStandardMaterial color="#6a6559" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
