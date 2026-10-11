import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      'flow-sdk': path.resolve(__dirname, './src/mock-flow-sdk.ts')
    }
  }
})
