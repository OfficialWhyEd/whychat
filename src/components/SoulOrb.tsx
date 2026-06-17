import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * SoulOrb — l'anima di WhyChat resa WebGL.
 * Un nucleo a shader che respira e si distorce (crimson → ember), avvolto in un rim-glow
 * fresnel e da un anello d'energia che ruota. Si "accende" quando WhyChat pensa (active).
 * Nato dallo shader che mi hai mandato, ma fatto orb e fatto mio: non decorazione, presenza.
 */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vNoise;

  // displacement organico: il nucleo non è mai fermo, respira
  float wob(vec3 p, float t) {
    float n  = sin(p.x * 3.0 + t)        * cos(p.y * 2.6 + t * 0.8);
    n       += sin(p.y * 5.0 - t * 1.3)  * cos(p.z * 4.2 + t * 1.1) * 0.5;
    n       += sin(p.z * 7.5 + t * 0.6)  * cos(p.x * 6.0 - t)       * 0.25;
    return n;
  }

  void main() {
    float t = uTime;
    float n = wob(position, t);
    vNoise = n;

    // spinge lungo la normale → superficie viva
    vec3 displaced = position + normal * n * (0.12 + 0.16 * uIntensity);

    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView   = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3  uCore;   // ember
  uniform vec3  uEdge;   // crimson
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vNoise;

  void main() {
    vec3  N = normalize(vNormal);
    vec3  V = normalize(vView);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.4); // rim-glow

    // colore: ember al centro, crimson ai bordi, modulato dal rumore
    vec3 col = mix(uEdge, uCore, clamp(vNoise * 0.5 + 0.5, 0.0, 1.0));
    col = mix(col, uCore, fres);                       // bordo che brucia
    col += fres * fres * 0.5 * uIntensity;             // alone più intenso quando pensa

    float alpha = clamp(0.32 + fres * 0.85, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

function Core({ active }: { active: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

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
    // intensità che insegue lo stato: sale dolce quando pensa, riposa quando ascolta
    const target = active ? 1.0 : 0.32 + Math.sin(t * 1.4) * 0.06;
    uniforms.uIntensity.value += (target - uniforms.uIntensity.value) * Math.min(dt * 3, 1);
    if (mesh.current) {
      mesh.current.rotation.y = t * (active ? 0.5 : 0.18);
      mesh.current.rotation.x = Math.sin(t * 0.3) * 0.25;
    }
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1, 24]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function EnergyRing({ active }: { active: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (mesh.current) {
      mesh.current.rotation.z = t * (active ? 1.1 : 0.4);
      const m = mesh.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.35 + Math.sin(t * (active ? 4 : 2)) * 0.2;
    }
  });
  return (
    <mesh ref={mesh} rotation={[Math.PI / 2.4, 0, 0]}>
      <ringGeometry args={[1.45, 1.52, 96]} />
      <meshBasicMaterial color="#c94b25" transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function SoulOrb({ size = 200, active = false }: { size?: number; active?: boolean }) {
  return (
    <div style={{ width: size, height: size }} aria-hidden>
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 3.4], fov: 42 }}
        style={{ background: "transparent" }}
      >
        <Core active={active} />
        <EnergyRing active={active} />
      </Canvas>
    </div>
  );
}
