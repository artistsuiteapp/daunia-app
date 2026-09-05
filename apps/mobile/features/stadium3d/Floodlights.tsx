import * as THREE from 'three';

/**
 * Illuminazione dello Zaccheria.
 *
 * Dalle foto aeree: due torri bianche che salgono dal tetto della Tribuna Centrale
 * e pali d'angolo con la testa a rettangolo di proiettori. I proiettori sono
 * materiali emissivi, non luci vere: quattro luci dinamiche in piu costerebbero
 * frame senza cambiare quasi nulla a schermo.
 */

type MastProps = {
  position: [number, number, number];
  height: number;
  /** rotazione attorno all'asse verticale, per orientare la testa verso il campo */
  yaw: number;
  scale?: number;
};

function Mast({ position, height, yaw, scale = 1 }: MastProps) {
  const headW = 7 * scale;
  const headH = 4.4 * scale;
  const lampCols = 5;
  const lampRows = 3;

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* fusto */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[1.5 * scale, height, 1.5 * scale]} />
        <meshStandardMaterial color="#d7d4cd" roughness={0.75} metalness={0.1} />
      </mesh>
      {/* traliccio della testa */}
      <mesh position={[0, height + headH / 2, 0]}>
        <boxGeometry args={[headW, headH, 0.7 * scale]} />
        <meshStandardMaterial color="#4a4740" roughness={0.8} />
      </mesh>
      {/* proiettori */}
      {Array.from({ length: lampRows }).flatMap((_, r) =>
        Array.from({ length: lampCols }).map((__, c) => {
          const x = -headW / 2 + (headW / lampCols) * (c + 0.5);
          const y = height + (headH / lampRows) * (r + 0.5);
          return (
            <mesh key={`${r}-${c}`} position={[x, y, 0.42 * scale]}>
              <boxGeometry args={[headW / lampCols - 0.25, headH / lampRows - 0.25, 0.3]} />
              <meshStandardMaterial
                color="#fff6da"
                emissive="#ffeeb8"
                emissiveIntensity={1.5}
                roughness={0.3}
              />
            </mesh>
          );
        }),
      )}
      {/* alone davanti ai proiettori */}
      <mesh position={[0, height + headH / 2, 1.4 * scale]}>
        <planeGeometry args={[headW * 1.5, headH * 1.7]} />
        <meshBasicMaterial color="#ffeec2" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Torre bianca di servizio sul tetto della Tribuna Centrale, come nelle foto. */
function RoofTower({ position, height }: { position: [number, number, number]; height: number }) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[5, height, 5]} />
        <meshStandardMaterial color="#e2ded6" roughness={0.8} />
      </mesh>
      <mesh position={[0, height + 0.6, 0]}>
        <boxGeometry args={[6.2, 1.2, 6.2]} />
        <meshStandardMaterial color="#b9b4aa" roughness={0.8} />
      </mesh>
      {/* fasce scure delle finestre */}
      {[0.35, 0.6, 0.85].map((f) => (
        <mesh key={f} position={[0, height * f, 0]}>
          <boxGeometry args={[5.15, 0.9, 5.15]} />
          <meshStandardMaterial color="#3a3833" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export function Floodlights({ pitchLength, pitchWidth, standTop }: {
  pitchLength: number; pitchWidth: number; standTop: number;
}) {
  const x = pitchLength / 2 + 26;
  const z = pitchWidth / 2 + 30;

  return (
    <group>
      {/* pali d'angolo, testa girata verso il centro del campo */}
      <Mast position={[-x, 0, -z]} height={30} yaw={Math.PI * 0.25} />
      <Mast position={[-x, 0, z]} height={30} yaw={Math.PI * 0.75} />
      <Mast position={[x, 0, z]} height={30} yaw={-Math.PI * 0.75} />
      <Mast position={[x, 0, -z]} height={30} yaw={-Math.PI * 0.25} />

      {/* torri sul tetto della Tribuna Centrale */}
      <RoofTower position={[-24, standTop, -52]} height={16} />
      <RoofTower position={[24, standTop, -52]} height={16} />
    </group>
  );
}

/** Nastro pubblicitario a bordo campo: una riga luminosa che chiude il rettangolo. */
export function LedBoards({ length, width }: { length: number; width: number }) {
  const h = 0.95;
  const y = h / 2;
  const dx = length / 2 + 3.4;
  const dz = width / 2 + 3.4;
  const mat = (
    <meshStandardMaterial color="#1a1a20" emissive="#8e0f16" emissiveIntensity={0.55} roughness={0.4} />
  );
  return (
    <group>
      {[-dz, dz].map((z) => (
        <mesh key={z} position={[0, y, z]}>
          <boxGeometry args={[length + 4, h, 0.3]} />
          {mat}
        </mesh>
      ))}
      {[-dx, dx].map((x) => (
        <mesh key={x} position={[x, y, 0]}>
          <boxGeometry args={[0.3, h, width + 4]} />
          {mat}
        </mesh>
      ))}
    </group>
  );
}
