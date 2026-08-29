import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The bundle is always served from the root — by the dev server, and by Express
  // in the single-image build, whose SPA fallback answers arbitrary paths with
  // index.html. Relative asset URLs would 404 for any path below the root.
  base: '/',
  server: { port: 3000 },
  // `build` rather than Vite's `dist`: the Dockerfile copies client/build into
  // server/public, and .gitignore/.dockerignore already name it.
  build: { outDir: 'build', target: 'es2022' },
  // @control-cove/shared is a symlinked `file:` dependency, which Vite leaves out
  // of dependency pre-bundling by default; without this its bare `zod` import is
  // resolved and served unbundled on every reload.
  optimizeDeps: { include: ['@control-cove/shared'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // api/config.ts throws at import time if this is undefined; '' means the
    // origin the page was served from, which is what the tests never call.
    env: { VITE_SERVER_URL: '' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/index.tsx', 'src/reportWebVitals.ts', 'src/setupTests.ts', 'src/**/*.test.{ts,tsx}'],
    },
  },
});
