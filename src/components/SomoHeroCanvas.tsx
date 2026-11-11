import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Float,
  Html,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
} from '@react-three/drei';
import * as THREE from 'three';
import { PresenceLight, PresenceState } from './PresenceLight';

export type IroEmotion = 'comfort' | 'shy' | 'surprised' | 'thinking' | 'confused' | 'angry' | 'sleepy' | 'joy';

interface EyeTargetParams {
  cx: number;
  cy: number;
  r: number;
  /** Offset from eye center (in px, where negative is above center). Values < -r mean no top clip. */
  topClipOffset: number;
  /** Angle in radians of the upper eyelid line. */
  topClipAngle: number;
  /** Center Y offset (below eye center) of the lower concave eyelid circle. Larger = less arch cut. */
  bottomArchOffset: number;
  /** Opacity of the pink blush below the eye (used in 'shy'). */
  blush: number;
  /** Brightness multiplier (1 = pure white, <1 = softer grey-white). */
  brightness: number;
}

interface EmotionPreset {
  headLift: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  left: EyeTargetParams;
  right: EyeTargetParams;
}

const EMOTION_PRESETS: Record<IroEmotion, EmotionPreset> = {
  comfort: {
    headLift: 5.5,
    headPitch: 0.0,
    headYaw: 0.0,
    headRoll: 0.0,
    left: {
      cx: 0,
      cy: -4,
      r: 72,
      topClipOffset: -86,
      topClipAngle: 0,
      bottomArchOffset: 102,
      blush: 0,
      brightness: 1.0,
    },
    right: {
      cx: 0,
      cy: -4,
      r: 72,
      topClipOffset: -86,
      topClipAngle: 0,
      bottomArchOffset: 102,
      blush: 0,
      brightness: 1.0,
    },
  },
  shy: {
    headLift: 5.2,
    headPitch: 0.07,
    headYaw: -0.05,
    headRoll: 0.06,
    left: {
      cx: -4,
      cy: -12,
      r: 68,
      topClipOffset: -86,
      topClipAngle: 0,
      bottomArchOffset: 76,
      blush: 1.0,
      brightness: 1.0,
    },
    right: {
      cx: -4,
      cy: -12,
      r: 68,
      topClipOffset: -86,
      topClipAngle: 0,
      bottomArchOffset: 76,
      blush: 1.0,
      brightness: 1.0,
    },
  },
  surprised: {
    headLift: 5.8,
    headPitch: -0.05,
    headYaw: 0.0,
    headRoll: 0.0,
    left: {
      cx: 0,
      cy: 0,
      r: 78,
      topClipOffset: -94,
      topClipAngle: 0,
      bottomArchOffset: 175,
      blush: 0,
      brightness: 1.0,
    },
    right: {
      cx: 0,
      cy: 0,
      r: 78,
      topClipOffset: -94,
      topClipAngle: 0,
      bottomArchOffset: 175,
      blush: 0,
      brightness: 1.0,
    },
  },
  thinking: {
    headLift: 5.55,
    headPitch: -0.06,
    headYaw: 0.12,
    headRoll: -0.04,
    left: {
      cx: 24,
      cy: 6,
      r: 72,
      topClipOffset: -34,
      topClipAngle: 0,
      bottomArchOffset: 175,
      blush: 0,
      brightness: 1.0,
    },
    right: {
      cx: 24,
      cy: 6,
      r: 72,
      topClipOffset: -34,
      topClipAngle: 0,
      bottomArchOffset: 175,
      blush: 0,
      brightness: 1.0,
    },
  },
  confused: {
    headLift: 5.5,
    headPitch: 0.02,
    headYaw: -0.05,
    headRoll: 0.09,
    left: {
      cx: 0,
      cy: 0,
      r: 74,
      topClipOffset: -54,
      topClipAngle: 0,
      bottomArchOffset: 175,
      blush: 0,
      brightness: 1.0,
    },
    right: {
      cx: 0,
      cy: 8,
      r: 70,
      topClipOffset: -2,
      topClipAngle: 0,
      bottomArchOffset: 175,
      blush: 0,
      brightness: 1.0,
    },
  },
  angry: {
    headLift: 5.3,
    headPitch: 0.08,
    headYaw: 0.0,
    headRoll: 0.0,
    left: {
      cx: 6,
      cy: 10,
      r: 72,
      topClipOffset: -16,
      topClipAngle: 0.45,
      bottomArchOffset: 175,
      blush: 0,
      brightness: 1.0,
    },
    right: {
      cx: -6,
      cy: 10,
      r: 72,
      topClipOffset: -16,
      topClipAngle: -0.45,
      bottomArchOffset: 175,
      blush: 0,
      brightness: 1.0,
    },
  },
  // Heavy lids, dimmed eyes, head slumped on a lowered actuator.
  sleepy: {
    headLift: 4.6,
    headPitch: 0.17,
    headYaw: 0.0,
    headRoll: 0.05,
    left: {
      cx: 0,
      cy: 10,
      r: 70,
      topClipOffset: 16,
      topClipAngle: 0,
      bottomArchOffset: 175,
      blush: 0,
      brightness: 0.68,
    },
    right: {
      cx: 0,
      cy: 10,
      r: 70,
      topClipOffset: 16,
      topClipAngle: 0,
      bottomArchOffset: 175,
      blush: 0,
      brightness: 0.68,
    },
  },
  // Upturned crescent eyes (^ ^) with a little blush, head raised.
  joy: {
    headLift: 6.0,
    headPitch: -0.08,
    headYaw: 0.0,
    headRoll: -0.03,
    left: {
      cx: 0,
      cy: -8,
      r: 80,
      topClipOffset: -94,
      topClipAngle: 0,
      bottomArchOffset: 60,
      blush: 0.85,
      brightness: 1.0,
    },
    right: {
      cx: 0,
      cy: -8,
      r: 80,
      topClipOffset: -94,
      topClipAngle: 0,
      bottomArchOffset: 60,
      blush: 0.85,
      brightness: 1.0,
    },
  },
};

function drawSingleCircularEye(
  ctx: CanvasRenderingContext2D,
  state: EyeTargetParams,
  gazeX: number,
  gazeY: number,
  blinkClose: number
) {
  const W = 256;
  const H = 256;
  const centerX = 128;
  const centerY = 128;

  ctx.clearRect(0, 0, W, H);

  // Pitch-black circular GC9A01 OLED background
  ctx.fillStyle = '#040406';
  ctx.fillRect(0, 0, W, H);

  const ex = centerX + state.cx + gazeX;
  const ey = centerY + state.cy + gazeY;
  const r = state.r;

  // Apply blink to topClipOffset (pushes top eyelid down across the eye)
  const effectiveTopClip = THREE.MathUtils.lerp(state.topClipOffset, r + 8, blinkClose);

  // Helper to build the clipped eye silhouette path
  const buildEyeClipRegion = () => {
    // 1. Upper eyelid half-plane (everything below the angled line through (ex, ey + effectiveTopClip))
    ctx.beginPath();
    ctx.save();
    ctx.translate(ex, ey + effectiveTopClip);
    ctx.rotate(state.topClipAngle);
    ctx.rect(-256, 0, 512, 512);
    ctx.restore();
    ctx.clip();

    // 2. Main circular eye contour
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.clip();
  };

  // Pass 1: Soft outer white glow around the eye shape (matching the reference sheet bloom)
  ctx.save();
  buildEyeClipRegion();

  const b = Math.round(255 * state.brightness);
  const edgeB = Math.round(218 * state.brightness);
  const eyeGrad = ctx.createRadialGradient(ex, ey - r * 0.12, r * 0.1, ex, ey, r);
  eyeGrad.addColorStop(0, `rgb(${b}, ${b}, ${b})`);
  eyeGrad.addColorStop(0.78, `rgb(${b}, ${b}, ${b})`);
  eyeGrad.addColorStop(1, `rgb(${edgeB}, ${edgeB}, ${Math.min(255, edgeB + 4)})`);

  ctx.fillStyle = eyeGrad;
  ctx.fillRect(ex - r - 4, ey - r - 4, (r + 4) * 2, (r + 4) * 2);

  // Carve out the lower concave eyelid arch if active (e.g. 'comfort' and 'shy')
  if (state.bottomArchOffset < 155) {
    const archRadius = 86;
    const archY = ey + state.bottomArchOffset;
    ctx.fillStyle = '#040406';
    ctx.beginPath();
    ctx.arc(ex, archY, archRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Subtle soft glow ring around the eye
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const haloGrad = ctx.createRadialGradient(ex, ey, r * 0.68, ex, ey, r * 1.28);
  haloGrad.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
  haloGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)');
  haloGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(ex, ey, r * 1.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Re-mask the top & bottom eyelids cleanly over the halo glow so the cut edges stay crisp with soft bloom
  ctx.save();
  ctx.translate(ex, ey + effectiveTopClip);
  ctx.rotate(state.topClipAngle);
  const lidFade = ctx.createLinearGradient(0, -14, 0, 2);
  lidFade.addColorStop(0, '#040406');
  lidFade.addColorStop(0.75, '#040406');
  lidFade.addColorStop(1, 'rgba(4, 4, 6, 0)');
  ctx.fillStyle = lidFade;
  ctx.fillRect(-200, -200, 400, 202);
  ctx.restore();

  if (state.bottomArchOffset < 155) {
    const archRadius = 85;
    const archY = ey + state.bottomArchOffset;
    ctx.save();
    ctx.fillStyle = '#040406';
    ctx.beginPath();
    ctx.arc(ex, archY, archRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Soft pastel-pink cheek blush blob tucked under the smiling eye arch (used in 'shy' emotion)
  if (state.blush > 0.01) {
    ctx.save();
    const bx = ex;
    const by = ey + 52;
    ctx.translate(bx, by);
    ctx.scale(2.15, 0.92);
    const blushGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
    blushGrad.addColorStop(0, `rgba(255, 198, 224, ${0.46 * state.blush})`);
    blushGrad.addColorStop(0.5, `rgba(248, 174, 210, ${0.22 * state.blush})`);
    blushGrad.addColorStop(1, 'rgba(248, 174, 210, 0)');
    ctx.fillStyle = blushGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

const HEAD_NODES = new Set(['Head_Dome_Cap', 'Head_Dome_Amber', 'Head_Neck_Visor']);

const INTERNAL_HIDDEN_NODES = new Set([
  'Eye_Left_GC9A01',
  'Eye_Right_GC9A01',
  'Sensor_Camera_Arducam',
  'Sensor_Mic_INMP441',
  'Drive_Linear_Actuator',
  'Compute_Raspberry_Pi_5',
  'Internal_Chassis',
]);

interface IroRobotModelProps {
  emotion: IroEmotion;
  presence: PresenceState;
  onCycleEmotion: () => void;
  active?: boolean;
}

const GLB_URL = `${import.meta.env.BASE_URL}models/somo-assembly.glb?v=33`;

const SpringCameraReturn: React.FC = () => {
  const controlsRef = useRef<any>(null);
  const isDraggingRef = useRef(false);
  const springVelRef = useRef({ azim: 0, polar: 0 });

  // Default camera spherical angles matching position={[0, 0.35, 6.8]} -> azim = 0, polar = 1.5194
  const TARGET_AZIM = 0.0;
  const TARGET_POLAR = Math.acos(0.35 / Math.hypot(0.35, 6.8));

  useFrame((_, delta) => {
    const ctrl = controlsRef.current;
    if (!ctrl || isDraggingRef.current) {
      springVelRef.current.azim = 0;
      springVelRef.current.polar = 0;
      return;
    }

    const dt = Math.min(delta, 0.05);
    const curAzim = ctrl.getAzimuthalAngle();
    const curPolar = ctrl.getPolarAngle();

    // Shortest angular difference to front-facing target azimuth
    let diffAzim = TARGET_AZIM - curAzim;
    diffAzim = Math.atan2(Math.sin(diffAzim), Math.cos(diffAzim));
    const diffPolar = TARGET_POLAR - curPolar;

    if (
      Math.abs(diffAzim) > 0.0005 ||
      Math.abs(diffPolar) > 0.0005 ||
      Math.abs(springVelRef.current.azim) > 0.0005 ||
      Math.abs(springVelRef.current.polar) > 0.0005
    ) {
      // Spring-damper physics (snappy spring-back with slight natural elastic settle)
      const stiffness = 24.0;
      const damping = 6.2;

      springVelRef.current.azim += (diffAzim * stiffness - springVelRef.current.azim * damping) * dt;
      springVelRef.current.polar += (diffPolar * stiffness - springVelRef.current.polar * damping) * dt;

      ctrl.setAzimuthalAngle(curAzim + springVelRef.current.azim * dt);
      ctrl.setPolarAngle(
        THREE.MathUtils.clamp(
          curPolar + springVelRef.current.polar * dt,
          Math.PI / 6,
          Math.PI / 1.85
        )
      );
      ctrl.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      target={[0, 0, 0]}
      enableZoom={false}
      enablePan={false}
      enableDamping={false}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 1.85}
      onStart={() => {
        isDraggingRef.current = true;
      }}
      onEnd={() => {
        isDraggingRef.current = false;
      }}
    />
  );
};

const IroRobotModel: React.FC<IroRobotModelProps> = ({ emotion, presence, onCycleEmotion }) => {
  const gltf = useGLTF(GLB_URL);
  const { size } = useThree();

  // Tell the scroll story it can start fetching frames now that the hero is ready.
  useEffect(() => {
    (window as Window & { __iroModelReady?: boolean }).__iroModelReady = true;
    window.dispatchEvent(new Event('iro:model-ready'));
  }, []);
  const isStacked = size.width < 900 || size.height > size.width;
  const aspect = size.width / Math.max(1, size.height);
  const responsiveFactor = Math.min(1, aspect / 0.82);
  const baseScale = isStacked ? 0.1 : 0.12;
  const modelScale = Math.max(0.068, baseScale * responsiveFactor);
  const modelPosY = isStacked ? -0.06 : -0.18;

  const headPivotRef = useRef<THREE.Group>(null);
  const headLiftRef = useRef<THREE.Group>(null);
  const bodyGroupRef = useRef<THREE.Group>(null);

  // Dual 240x240 GC9A01 circular eye canvases & textures
  const eyeResources = useMemo(() => {
    const leftCanvas = document.createElement('canvas');
    leftCanvas.width = 256;
    leftCanvas.height = 256;
    const rightCanvas = document.createElement('canvas');
    rightCanvas.width = 256;
    rightCanvas.height = 256;

    const leftTex = new THREE.CanvasTexture(leftCanvas);
    leftTex.colorSpace = THREE.SRGBColorSpace;
    leftTex.needsUpdate = true;

    const rightTex = new THREE.CanvasTexture(rightCanvas);
    rightTex.colorSpace = THREE.SRGBColorSpace;
    rightTex.needsUpdate = true;

    return {
      leftCanvas,
      leftCtx: leftCanvas.getContext('2d')!,
      leftTex,
      rightCanvas,
      rightCtx: rightCanvas.getContext('2d')!,
      rightTex,
    };
  }, []);

  useEffect(() => {
    return () => {
      eyeResources.leftTex.dispose();
      eyeResources.rightTex.dispose();
    };
  }, [eyeResources]);

  // Smoothly interpolated live eye state
  const liveLeftRef = useRef<EyeTargetParams>({ ...EMOTION_PRESETS.comfort.left });
  const liveRightRef = useRef<EyeTargetParams>({ ...EMOTION_PRESETS.comfort.right });
  const blinkTimerRef = useRef({ nextBlinkAt: 2.6, blinkProgress: 0, isBlinking: false });

  const clonedNodes = useMemo(() => {
    const list: { name: string; meshes: { geometry: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial }[] }[] =
      [];

    gltf.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.parent) {
        const rawName = obj.parent.name && obj.parent.name !== 'Scene' ? obj.parent.name : obj.name;
        const nodeName = rawName.replace(/_\d+$/, '');
        if (INTERNAL_HIDDEN_NODES.has(nodeName)) {
          return;
        }
        const existing = list.find((n) => n.name === nodeName);
        const stdMat = (obj.material as THREE.MeshStandardMaterial).clone();
        if (nodeName === 'Screen_Chest_TFT') {
          stdMat.color.set('#050608');
          stdMat.roughness = 0.12;
          stdMat.metalness = 0.15;
          stdMat.envMapIntensity = 1.4;
        } else if (stdMat.transparent || stdMat.opacity < 0.999) {
          stdMat.transparent = true;
          stdMat.roughness = 0.1;
          stdMat.metalness = 0.2;
          stdMat.envMapIntensity = 1.6;
          stdMat.depthWrite = false;
        } else {
          stdMat.roughness = Math.max(0.24, stdMat.roughness);
          stdMat.envMapIntensity = 1.15;
        }

        if (existing) {
          existing.meshes.push({ geometry: obj.geometry, mat: stdMat });
        } else {
          list.push({
            name: nodeName,
            meshes: [{ geometry: obj.geometry, mat: stdMat }],
          });
        }
      }
    });
    return list;
  }, [gltf]);

  useFrame(({ pointer: rawPointer, clock }, delta) => {
    // Asleep iro settles slowly and barely follows the cursor.
    const asleep = emotion === 'sleepy';
    const damp = Math.min(1, delta * (asleep ? 2.2 : 7.5));
    const preset = EMOTION_PRESETS[emotion];
    const t = clock.getElapsedTime();
    const follow = asleep ? 0.12 : 1;
    const pointer = { x: rawPointer.x * follow, y: rawPointer.y * follow };

    // 1. Smoothly animate linear-actuator head lift + expressive head tilt & cursor tracking
    if (headLiftRef.current) {
      // Sleep breathes slower and deeper; joy bounces.
      const breathingBob =
        emotion === 'sleepy'
          ? Math.sin(t * 1.1) * 0.12
          : emotion === 'joy'
            ? Math.abs(Math.sin(t * 6.5)) * 0.32
            : Math.sin(t * 2.1) * 0.08;
      const targetLift = preset.headLift + breathingBob;
      headLiftRef.current.position.y = THREE.MathUtils.lerp(
        headLiftRef.current.position.y,
        targetLift,
        damp
      );
    }

    if (headPivotRef.current) {
      const targetYaw = preset.headYaw + pointer.x * 0.28;
      const targetPitch = preset.headPitch - pointer.y * 0.14;
      const targetRoll = preset.headRoll - pointer.x * 0.05;

      headPivotRef.current.rotation.y = THREE.MathUtils.lerp(headPivotRef.current.rotation.y, targetYaw, damp);
      headPivotRef.current.rotation.x = THREE.MathUtils.lerp(headPivotRef.current.rotation.x, targetPitch, damp);
      headPivotRef.current.rotation.z = THREE.MathUtils.lerp(headPivotRef.current.rotation.z, targetRoll, damp);
    }

    if (bodyGroupRef.current) {
      const baseYaw = -0.34 + pointer.x * 0.12;
      const basePitch = 0.06 - pointer.y * 0.05;
      bodyGroupRef.current.rotation.y = THREE.MathUtils.lerp(bodyGroupRef.current.rotation.y, baseYaw, damp);
      bodyGroupRef.current.rotation.x = THREE.MathUtils.lerp(bodyGroupRef.current.rotation.x, basePitch, damp);
    }

    // 2. Smoothly interpolate left and right circular GC9A01 eye parameters
    const lerpParams = (cur: EyeTargetParams, tgt: EyeTargetParams) => {
      cur.cx = THREE.MathUtils.lerp(cur.cx, tgt.cx, damp);
      cur.cy = THREE.MathUtils.lerp(cur.cy, tgt.cy, damp);
      cur.r = THREE.MathUtils.lerp(cur.r, tgt.r, damp);
      cur.topClipOffset = THREE.MathUtils.lerp(cur.topClipOffset, tgt.topClipOffset, damp);
      cur.topClipAngle = THREE.MathUtils.lerp(cur.topClipAngle, tgt.topClipAngle, damp);
      cur.bottomArchOffset = THREE.MathUtils.lerp(cur.bottomArchOffset, tgt.bottomArchOffset, damp);
      cur.blush = THREE.MathUtils.lerp(cur.blush, tgt.blush, damp);
      cur.brightness = THREE.MathUtils.lerp(cur.brightness, tgt.brightness, damp);
    };

    lerpParams(liveLeftRef.current, preset.left);
    lerpParams(liveRightRef.current, preset.right);

    // 3. Natural periodic blink
    const bt = blinkTimerRef.current;
    let blinkClose = 0;
    if (!bt.isBlinking && !asleep && t >= bt.nextBlinkAt) {
      bt.isBlinking = true;
      bt.blinkProgress = 0;
    }
    if (bt.isBlinking) {
      bt.blinkProgress += delta * 7.5;
      if (bt.blinkProgress >= 1) {
        bt.isBlinking = false;
        bt.nextBlinkAt = t + 2.8 + Math.random() * 2.6;
        blinkClose = 0;
      } else {
        blinkClose = Math.sin(bt.blinkProgress * Math.PI);
      }
    }

    const gazeX = pointer.x * 10.5;
    const gazeY = -pointer.y * 8.0;

    drawSingleCircularEye(eyeResources.leftCtx, liveLeftRef.current, gazeX, gazeY, blinkClose);
    drawSingleCircularEye(eyeResources.rightCtx, liveRightRef.current, gazeX, gazeY, blinkClose);
    eyeResources.leftTex.needsUpdate = true;
    eyeResources.rightTex.needsUpdate = true;
  });

  const renderNode = (node: (typeof clonedNodes)[number]) => (
    <group key={node.name}>
      {node.meshes.map((m, idx) => (
        <mesh key={idx} geometry={m.geometry} material={m.mat} castShadow receiveShadow />
      ))}
    </group>
  );

  const headNodes = clonedNodes.filter((n) => HEAD_NODES.has(n.name));
  const bodyNodes = clonedNodes.filter((n) => !HEAD_NODES.has(n.name));

  return (
    <group
      ref={bodyGroupRef}
      position={[0, modelPosY, 0]}
      rotation={[0.06, -0.34, 0]}
      scale={modelScale}
      onClick={(e) => {
        e.stopPropagation();
        onCycleEmotion();
      }}
    >
      {/* Center the CAD assembly's vertical range at origin */}
      <group position={[0, -13.2, 0]}>
        <group ref={headLiftRef} position={[0, 5.5, 0]}>
          <group ref={headPivotRef} position={[0, 16.5, 0]}>
            <group position={[0, -16.5, 0]}>
              {headNodes.map(renderNode)}

              {/* Left Circular GC9A01 Eye Display (orthogonal to face 49 cylinder axis: rotation.y = +0.0873) */}
              <mesh position={[-2.584, 16.155, 6.82]} rotation={[0, 0.0873, 0]}>
                <circleGeometry args={[1.24, 64]} />
                <meshBasicMaterial map={eyeResources.leftTex} toneMapped={false} />
              </mesh>

              {/* Right Circular GC9A01 Eye Display (orthogonal to face 46 cylinder axis: rotation.y = -0.0873) */}
              <mesh position={[2.571, 16.155, 6.82]} rotation={[0, -0.0873, 0]}>
                <circleGeometry args={[1.24, 64]} />
                <meshBasicMaterial map={eyeResources.rightTex} toneMapped={false} />
              </mesh>
            </group>
          </group>
        </group>

        <group>
          {bodyNodes.map(renderNode)}

          <PresenceLight state={presence} />
        </group>
      </group>
    </group>
  );
};

interface SomoHeroCanvasProps {
  emotion: IroEmotion;
  presence: PresenceState;
  onCycleEmotion: () => void;
  active?: boolean;
}

export const SomoHeroCanvas: React.FC<SomoHeroCanvasProps> = ({ emotion, presence, onCycleEmotion, active = true }) => {
  return (
    <div className="hero-3d-canvas-wrap">
      <Canvas
        shadows
        frameloop={active ? 'always' : 'never'}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <PerspectiveCamera makeDefault position={[0, 0.35, 6.8]} fov={35} />

        <ambientLight intensity={0.88} />
        <spotLight
          position={[4.5, 8.0, 6.5]}
          angle={0.48}
          penumbra={0.9}
          intensity={2.4}
          color="#fffaf0"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <spotLight
          position={[-5.5, 4.0, -4.5]}
          angle={0.55}
          penumbra={1}
          intensity={1.2}
          color="#fde68a"
        />
        <pointLight position={[0, -2.0, 3.5]} intensity={0.6} color="#ffffff" />

        <Suspense
          fallback={
            <Html center>
              <div className="canvas-loader-pill">
                <span className="loader-spinner" />
              </div>
            </Html>
          }
        >
          <Environment preset="city" />
          <Float speed={1.1} rotationIntensity={0.025} floatIntensity={0.07}>
            <IroRobotModel emotion={emotion} presence={presence} onCycleEmotion={onCycleEmotion} />
          </Float>

          <ContactShadows
            position={[0, -1.72, 0]}
            opacity={0.6}
            scale={7.5}
            blur={2.4}
            far={4.5}
            color="#000000"
          />
        </Suspense>

        <SpringCameraReturn />
      </Canvas>
    </div>
  );
};

useGLTF.preload(GLB_URL);
