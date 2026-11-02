import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/somo/',
  plugins: [react()],
  assetsInclude: ['**/*.glb', '**/*.f3d'],
});
