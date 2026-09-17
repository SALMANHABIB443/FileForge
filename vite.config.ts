import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import path from 'path'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.svg',
        'icons/apple-touch-icon.png',
        'icons/favicon-32.png',
        'robots.txt',
        'fonts/*.woff2',
      ],
      manifest: {
        name: 'FileForge',
        short_name: 'FileForge',
        description:
          'A privacy-first file toolbox: image, PDF, video, audio, archive and developer tools — all processed on your device.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FAF9F7',
        theme_color: '#8B6B52',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        globIgnores: ['**/ffmpeg/**'],
        navigateFallbackDenylist: [/^\/ffmpeg\//],
        runtimeCaching: [
          {
            urlPattern: /\/ffmpeg\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fileforge-ffmpeg',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    target: 'es2022',
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**', 'electron/**'],
      exclude: [
        'src/test/**',
        'electron/engines/test-util.ts',
        'electron/engines/worker-src/**',
        '**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/pwa-register-stub.ts',
      ],
    },
  },
})