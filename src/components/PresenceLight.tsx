import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type PresenceState = 'rest' | 'listening' | 'thinking' | 'happy';

const COLORS: Record<PresenceState, string> = {
  rest: '#efc56b',
  listening: '#77baff',
  thinking: '#77baff',
  happy: '#f5a623',
};

/** A single hue of diffused light, contained within the chest display. */
export const PresenceLight: React.FC<{ state: PresenceState }> = ({ state }) => {
  const active = useRef(state);
  const elapsed = useRef(0);
  const visibility = useRef(0);
  const reducedMotion = useRef(false);
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(COLORS[state]) },
    uRadius: { value: 0.23 },
    uIntensity: { value: 0 },
    uShimmer: { value: 0 },
    uTime: { value: 0 },
  }), []);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = preference.matches; };
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    // Fade fully out before switching hue; never crossfade two colors.
    if (active.current !== state) {
      visibility.current = Math.max(0, visibility.current - dt * 2.5);
      if (visibility.current === 0) {
        active.current = state;
        elapsed.current = 0;
        uniforms.uColor.value.set(COLORS[state]);
      }
    } else {
      visibility.current = Math.min(1, visibility.current + dt * 1.8);
      elapsed.current += dt;
    }

    const t = elapsed.current;
    let radius = 0.23;
    let intensity = 0.48;
    let shimmer = 0;
    if (!reducedMotion.current) {
      switch (active.current) {
        case 'rest': {
          const breath = Math.sin(t * Math.PI * 2 / 9);
          radius += breath * 0.008;
          intensity += breath * 0.035;
          break;
        }
        case 'listening': {
          const expansion = 1 - Math.exp(-t * 1.3);
          radius = 0.18 + 0.14 * expansion;
          intensity = 0.65;
          break;
        }
        case 'thinking':
          radius = 0.22;
          intensity = 0.56 + Math.sin(t * 2.4) * 0.035;
          shimmer = 0.1;
          break;
        case 'happy': {
          const delight = Math.sin(Math.min(t / 2.4, 1) * Math.PI) ** 2;
          radius = 0.23 + delight * 0.08;
          intensity = 0.48 + delight * 0.4;
          break;
        }
      }
    }
    uniforms.uRadius.value = radius;
    uniforms.uIntensity.value = intensity * visibility.current;
    uniforms.uShimmer.value = shimmer;
    uniforms.uTime.value = t;
  });

  return (
    <mesh position={[0, 8.15, 12.19]} rotation={[-0.1877, 0, 0]}>
      <planeGeometry args={[3.5, 3.5]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform float uRadius, uIntensity, uShimmer, uTime;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv - 0.5;
            float d = length(p);
            float glow = exp(-3.0 * d * d / (uRadius * uRadius));
            float edge = 1.0 - smoothstep(0.38, 0.49, d);
            float shimmer = 1.0 + uShimmer * sin(p.x * 22.0 + p.y * 12.0 - uTime * 2.0);
            gl_FragColor = vec4(uColor, glow * edge * shimmer * uIntensity);
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
};
