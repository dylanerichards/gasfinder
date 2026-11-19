import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Standalone from vite.config.ts on purpose: that config loads vite-plugin-ruby,
// which expects the Rails/vite_ruby runtime. Here we only need React + jsdom.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    include: ['app/frontend/**/*.test.{js,jsx}'],
  },
})
