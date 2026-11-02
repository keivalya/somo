import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
} from '@react-three/drei';
import * as THREE from 'three';

interface CadPartViewerProps {
  glbPath: string;
  wireframe: boolean;
  autoRotate: boolean;
}

const SingleCadModel: React.FC<{ glbPath: string; wireframe: boolean }> = ({ glbPath, wireframe }) => {
  const gltf = useGLTF(glbPath);

  const { clonedScene, normScale, offset } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = (obj.material as THREE.MeshStandardMaterial).clone();
        mat.wireframe = wireframe;
        mat.envMapIntensity = 1.4;
        obj.material = mat;
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const targetSize = 2.4;
    const scale = targetSize / maxDim;

    return {
      clonedScene: clone,
      normScale: scale,
      offset: [-center.x, -center.y, -center.z] as [number, number, number],
    };
  }, [gltf, wireframe]);

  return (
    <group scale={normScale}>
      <primitive object={clonedScene} position={offset} />
    </group>
  );
};

export const CadPartViewer: React.FC<CadPartViewerProps> = ({ glbPath, wireframe, autoRotate }) => {
  return (
    <div className="part-viewer-canvas">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[2.4, 1.5, 3.2]} fov={38} />
        <ambientLight intensity={0.85} />
        <spotLight position={[5, 8, 5]} intensity={2.2} angle={0.5} penumbra={0.8} castShadow />
        <pointLight position={[-5, -3, -4]} intensity={1.1} color="#38bdf8" />
        <Suspense
          fallback={
            <Html center>
              <div className="canvas-loader-pill">
                <span className="loader-spinner" />
                <span>Loading 3D Mesh…</span>
              </div>
            </Html>
          }
        >
          <Environment preset="city" />
          <SingleCadModel glbPath={glbPath} wireframe={wireframe} />
          <ContactShadows position={[0, -1.3, 0]} opacity={0.5} scale={6} blur={2.2} />
        </Suspense>
        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          enablePan={false}
          minDistance={1.8}
          maxDistance={7.5}
          autoRotate={autoRotate}
          autoRotateSpeed={1.8}
        />
      </Canvas>
    </div>
  );
};
