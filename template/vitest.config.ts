import { fileURLToPath, URL } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Self-contained rather than merging vite.config: that config is a function form
// (it reads `mode` via loadEnv), which mergeConfig can't accept. Unit tests only
// need the `@` alias, the Vue SFC transform, and a jsdom environment.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    root: fileURLToPath(new URL('./', import.meta.url)),
    // Pin the API env so the suite doesn't depend on whatever .env.local the
    // developer has. Empty = mock mode, which is the documented default; the
    // live-mode tests opt in explicitly via vi.stubEnv + vi.resetModules.
    env: {
      VITE_CONCIAR_API_URL: '',
    },
    coverage: {
      provider: 'v8',
      // Excludes bootstrap/data files with no branching logic of their own,
      // so the threshold reflects actual app logic rather than boilerplate.
      exclude: [
        ...(configDefaults.coverage?.exclude ?? []),
        'server.mjs',
        'src/main.ts',
        'src/App.vue',
        'src/locales/**',
        'src/types/**',
        'src/**/*.d.ts',
        'src/test-support/**',
        'e2e/**',
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        branches: 90,
        functions: 90,
      },
    },
  },
})
