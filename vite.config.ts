import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages対応(v2追加): リポジトリのサブパスに配信する場合は VITE_BASE=/hikaru-todo/ のように指定する。
// ローカル開発・従来のホスティングでは未設定のままでよい(base '/')。
const base = process.env.VITE_BASE || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icons/icon.svg',
        'icons/icon-maskable.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
      ],
      manifest: {
        name: 'ひかるのやることリスト',
        short_name: 'やること',
        description: '階層型タスク管理PWA。ゴール→ステップ→Todoを一目で俯瞰。',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        start_url: base,
        scope: base,
        lang: 'ja',
        // ウィジェットショートカット(v3追加)。Android: アイコン長押し→「今日のやること」。
        // baseとの整合のためURLは相対("./?widget=1")で指定する(manifestのscope基準で解決される)。
        shortcuts: [
          {
            name: '今日のやること',
            url: './?widget=1',
            icons: [
              {
                src: `${base}icons/icon-192.png`,
                sizes: '192x192',
                type: 'image/png',
              },
            ],
          },
        ],
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}icons/icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: `${base}icons/icon-maskable.svg`,
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
