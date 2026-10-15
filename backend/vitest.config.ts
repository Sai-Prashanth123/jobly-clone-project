import { defineConfig } from 'vitest/config';

// Backend-local config so vitest doesn't inherit the frontend's vite.config.ts
// (which wires a browser setup file that doesn't exist here).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    // Placeholder credentials so a test may import a SERVICE, not just a lib.
    //
    // config/env.ts validates on import and calls process.exit(1) when these
    // are missing, and config/supabase.ts imports it — so anything reaching a
    // service module killed the run outright. That is why every backend test
    // until now lived in src/lib: the service layer, where the authorisation
    // rules actually are, was untestable by construction.
    //
    // These point at nothing. A test that genuinely talks to Supabase will
    // fail on the network, which is the correct outcome for a unit test; this
    // only gets module import past the validator.
    env: {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
