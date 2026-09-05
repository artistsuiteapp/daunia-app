import { useMemo } from 'react';
import * as THREE from 'three';

const LINE = '#e9efe9';
const LINE_OP = 0.72;

/**
 * Prato con le righe di taglio, la segnaletica regolamentare e le porte.
 * Le righe alternate sono l'elemento che piu di ogni altro fa leggere il rettangolo
 * come un campo vero invece che come un piano verde.
 */
export function Pitch({ length, width }: { length: number; width: number }) {
  const stripes = useMemo(() => {
    const n = 12;
    const w = length / n;
    return Array.from({ length: n }, (_, i) => ({
      x: -length / 2 + w / 2 + i * w,
      w,
      dark: i % 2 === 0,
    }));
  }, [length]);

  const halfL = length / 2;
  const halfW = width / 2;

  return (
    <group>
      {/* fascia di rispetto attorno al campo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow={false}>
        <planeGeometry args={[length + 22, width + 20]} />
        <meshStandardMaterial color="#2b2a26" roughness={1} />
      </mesh>

      {/* righe di taglio */}
      {stripes.map((s, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[s.x, 0, 0]}>
          <planeGeometry args={[s.w, width]} />
          <meshStandardMaterial color={s.dark ? '#1d6b30' : '#237a37'} roughness={0.95} />
        </mesh>
      ))}

      <Markings length={length} width={width} />

      <Goal x={-halfL} />
      <Goal x={halfL} flip />

      {/* cordolo chiaro sul bordo del terreno */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <planeGeometry args={[length + 5, width + 5]} />
        <meshStandardMaterial color="#1a5a28" roughness={1} />
      </mesh>
    </group>
  );
}

function Markings({ length, width }: { length: number; width: number }) {
  const halfL = length / 2;
  const halfW = width / 2;
  const y = 0.05;

  return (
    <group>
      <Rect x={0} z={0} w={length} h={width} y={y} />
      <Line x={0} z={0} w={0.25} h={width} y={y} />
      <Ring r={9.15} y={y} />
      <Dot x={0} y={y} />

      {[-1, 1].map((s) => (
        <group key={s}>
          {/* area di rigore 40,32 x 16,5 */}
          <Rect x={s * (halfL - 8.25)} z={0} w={16.5} h={40.32} y={y} />
          {/* area di porta 18,32 x 5,5 */}
          <Rect x={s * (halfL - 2.75)} z={0} w={5.5} h={18.32} y={y} />
          <Dot x={s * (halfL - 11)} y={y} />
        </group>
      ))}

      {/* archi d'angolo */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[sx * halfL, y, sz * halfW]}>
          <ringGeometry args={[0.9, 1.15, 12, 1]} />
          <meshBasicMaterial color={LINE} transparent opacity={LINE_OP} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** Rettangolo disegnato con quattro linee sottili, non con un piano pieno. */
function Rect({ x, z, w, h, y }: { x: number; z: number; w: number; h: number; y: number }) {
  const t = 0.25;
  return (
    <group position={[x, 0, z]}>
      <Line x={-w / 2} z={0} w={t} h={h} y={y} />
      <Line x={w / 2} z={0} w={t} h={h} y={y} />
      <Line x={0} z={-h / 2} w={w} h={t} y={y} />
      <Line x={0} z={h / 2} w={w} h={t} y={y} />
    </group>
  );
}

function Line({ x, z, w, h, y }: { x: number; z: number; w: number; h: number; y: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial color={LINE} transparent opacity={LINE_OP} />
    </mesh>
  );
}

function Ring({ r, y }: { r: number; y: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <ringGeometry args={[r - 0.13, r + 0.13, 64]} />
      <meshBasicMaterial color={LINE} transparent opacity={LINE_OP} />
    </mesh>
  );
}

function Dot({ x, y }: { x: number; y: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, y, 0]}>
      <circleGeometry args={[0.28, 12]} />
      <meshBasicMaterial color={LINE} transparent opacity={LINE_OP} />
    </mesh>
  );
}

/** Porta regolamentare: 7,32 di luce, 2,44 di altezza. */
function Goal({ x, flip = false }: { x: number; flip?: boolean }) {
  const w = 7.32;
  const h = 2.44;
  const dir = flip ? -1 : 1;
  return (
    <group position={[x, 0, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, h / 2, (s * w) / 2]}>
          <boxGeometry args={[0.18, h, 0.18]} />
          <meshStandardMaterial color="#f2f2f0" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, h, 0]}>
        <boxGeometry args={[0.18, 0.18, w]} />
        <meshStandardMaterial color="#f2f2f0" roughness={0.5} />
      </mesh>
      {/* rete, appena accennata */}
      <mesh position={[dir * 0.9, h / 2, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.8, h, w]} />
        <meshStandardMaterial color="#dfe3e6" transparent opacity={0.13} roughness={1} />
      </mesh>
    </group>
  );
}
