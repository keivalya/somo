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

/** A bright, diffused core and concentric halo beneath the chest glass. */
export const PresenceLight: React.FC<{ state: PresenceState }> = ({ state }) => {
  const active = useRef(state);
  const elapsed = useRef(0);
  const visibility = useRef(0);
  const reducedMotion = useRef(false);
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(COLORS[state]) },
    uRadius: { value: 0.175 },
    uIntensity: { value: 0 },
    uShimmer: { value: 0 },
    uHalo: { value: 1 },
    uBreathScale: { value: 1 },
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
    let radius = 0.175;
    let intensity = 0.72;
    let shimmer = 0;
    let halo = 1;
    let breathScale = 1;
    if (!reducedMotion.current) {
      // Smooth six-second inhale/exhale shared by the core and halo.
      const breath = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 6);
      breathScale = 0.94 + breath * 0.12;
      switch (active.current) {
        case 'rest': {
          intensity = 0.52 + breath * 0.38;
          breathScale = 0.90 + breath * 0.20;
          halo = 0.92 + breath * 0.18;
          break;
        }
        case 'listening': {
          // One deliberate opening gesture, followed by an attentive hold.
          const progress = Math.min(t / 1.8, 1);
          const ease = progress * progress * (3 - 2 * progress);
          radius = 0.175 + 0.035 * ease;
          intensity = 0.78;
          halo = 1 + 0.2 * ease;
          break;
        }
        case 'thinking':
          radius = 0.175;
          intensity = 0.72;
          shimmer = 0.12;
          break;
        case 'happy': {
          const delight = Math.sin(Math.min(t / 2.4, 1) * Math.PI) ** 2;
          radius = 0.175 + delight * 0.014;
          intensity = 0.72 + delight * 0.22;
          halo = 1 + delight * 0.5;
          break;
        }
      }
    }
    uniforms.uRadius.value = radius;
    uniforms.uIntensity.value = intensity * visibility.current;
    uniforms.uShimmer.value = shimmer;
    uniforms.uHalo.value = halo;
    uniforms.uBreathScale.value = breathScale;
    uniforms.uTime.value = t;
  });

  return (
    <mesh position={[0, 8.15, 12.19]} rotation={[-0.1877, 0, 0]}>
      <planeGeometry args={[5.4, 4.4]} />
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
          uniform float uRadius, uIntensity, uShimmer, uHalo, uTime, uBreathScale;
          varying vec2 vUv;
          void main() {
            // Circular in physical screen coordinates, with generous dark space around it.
            vec2 p = (vUv - 0.5) * vec2(1.0, 4.4 / 5.4) / uBreathScale;
            float d = length(p);
            float ringDistance = d - uRadius;
            // Layered diffusion softens the halo around the luminous center.
            float rim = exp(-pow(ringDistance / 0.018, 2.0));
            float bloom = exp(-pow(ringDistance / (0.052 * uHalo), 2.0));
            float atmosphere = exp(-pow(d / 0.27, 4.0));
            // A bright Gaussian core fades continuously, without a defined border.
            float core = exp(-pow(d / 0.052, 2.0));
            float coreGlow = exp(-pow(d / 0.088, 2.0));
            // A fixed upper-left catchlight gives the halo depth. Thinking gently
            // shifts its luminance without rotating, chasing, or adding particles.
            float lighting = 0.79 + 0.21 * clamp((-p.x + p.y) / (uRadius * 1.42), -1.0, 1.0);
            float shimmer = 1.0 + uShimmer * sin(uTime * 1.7 + p.y * 9.0);
            float light = (rim * 0.52 + bloom * 0.25) * lighting * shimmer
                        + atmosphere * 0.065 + core * 0.82 + coreGlow * 0.18;
            float edge = 1.0 - smoothstep(0.32, 0.39, d);
            gl_FragColor = vec4(uColor, light * edge * uIntensity);
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
};
