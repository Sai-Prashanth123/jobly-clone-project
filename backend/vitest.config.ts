import { defineConfig } from 'vitest/config';

// Backend-local config so vitest doesn't inherit the frontend's vite.config.ts
// (which wires a browser setup file that doesn't exist here).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
