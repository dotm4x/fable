import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@dotm4x/fable': fileURLToPath(new URL('../packages/fable/source/index.ts', import.meta.url)),
    },
  },
})
