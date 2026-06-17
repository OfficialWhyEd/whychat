import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * SoulOrb — l'anima di WhyChat. Una sfera scura e traslucida con un rim-glow
 * che brucia (crimson → ember), avvolta da un halo sottile. Respira piano,
 * si accende quando WhyChat pensa. Niente blob: presenza quieta, viva.
 */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;

  float wob(vec3 p, float t) {
    float n  = sin(p.x * 2.4 + t)       * cos(p.y * 2.0 + t * 0.7);
    n       += sin(p.y * 3.6 - t * 1.1) * cos(p.z * 3.0 + t)       * 0.4;
    return n;
  }

  void main() {
    float n = wob(position, uTime);
    // displacement gentile: la superficie respira, non si gonfia
    vec3 displaced = position + normal * n * (0.035 + 0.045 * uIntensity);
    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView   = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3  uCore;
  uniform vec3  uEdge;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec3  N = normalize(vNormal);
    vec3  V = normalize(vView);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.8); // rim

    vec3 interior = uEdge * 0.18;                 // cuore scuro
    vec3 col = mix(interior, uCore, fres);        // brucia verso il bordo
    col += fres * fres * (0.45 + 0.55 * uIntensity);

    // alpha: centro traslucido, bordo pieno → legge come vetro/anima, non blob
    float alpha = clamp(0.14 + fres * 0.92, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

function Core({ active }: { active: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uCore: { value: new THREE.Color("#f0a36a") },
      uEdge: { value: new THREE.Color("#c94b25") },
    }),
    [],
  );
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    const target = active ? 1.0 : 0.28 + Math.sin(t * 1.1) * 0.05;
    uniforms.uIntensity.value += (target - uniforms.uIntensity.value) * Math.min(dt * 2.5, 1);
    if (mesh.current) {
      mesh.current.rotation.y = t * (active ? 0.34 : 0.12);
      mesh.current.rotation.x = Math.sin(t * 0.22) * 0.18;
    }
  });
  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1, 32]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/** Halo sottile che gira attorno al nucleo, rivolto verso la camera (cerchio pulito, non linee). */
function Halo({ active, radius, opacity }: { active: boolean; radius: number; opacity: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (mesh.current) {
      mesh.current.rotation.z = t * (active ? 0.5 : 0.2);
      const m = mesh.current.material as THREE.MeshBasicMaterial;
      m.opacity = opacity * (0.7 + Math.sin(t * (active ? 2.4 : 1.3)) * 0.3);
    }
  });
  return (
    <mesh ref={mesh}>
      <ringGeometry args={[radius, radius + 0.012, 160]} />
      <meshBasicMaterial color="#c94b25" transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function SoulOrb({ size = 180, active = false }: { size?: number; active?: boolean }) {
  return (
    <div style={{ width: size, height: size }} aria-hidden>
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 3.6], fov: 40 }}
        style={{ background: "transparent" }}
      >
        <Core active={active} />
        <Halo active={active} radius={1.42} opacity={0.32} />
        <Halo active={active} radius={1.66} opacity={0.12} />
      </Canvas>
    </div>
  );
}
