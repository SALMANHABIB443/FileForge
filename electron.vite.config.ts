import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          main: path.join(__dirname, 'electron/main.ts'),
          worker: path.join(__dirname, 'electron/engines/worker-src/worker.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { preload: path.join(__dirname, 'electron/preload.ts') },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    root: '.',
    resolve: {
      alias: {
        '@': path.join(__dirname, './src'),
        'virtual:pwa-register/react': path.join(__dirname, 'src/pwa-register-stub.ts'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        input: path.join(__dirname, 'index.html'),
      },
    },
  },
})