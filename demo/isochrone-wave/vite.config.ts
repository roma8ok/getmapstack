import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The built site lives under /getmapstack/ on Pages; the dev server stays at the
// root, where a base path would only make local URLs longer.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/getmapstack/' : '/',
  plugins: [react()],
  test: { environment: 'jsdom' },
}));
