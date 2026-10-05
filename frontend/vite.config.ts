import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const backendTarget = env.VITE_API_TARGET ?? 'http://localhost:8080'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': backendTarget,
        '/assets': backendTarget,
      },
    },
    test: {
      environment: 'jsdom',
      pool: 'vmThreads',
      setupFiles: ['./src/test/setup.ts'],
      maxWorkers: 4,
      // El valor por defecto de 5 s aborta pruebas legitimas cuando la maquina
      // esta cargada; ver scripts/check-test-timeouts.node-test.mjs.
      testTimeout: 30000,
      hookTimeout: 30000,
      restoreMocks: true,
      clearMocks: true,
    },
  }
})
