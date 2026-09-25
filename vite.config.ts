import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Відносні шляхи: застосунок можна викласти на будь-який статичний хостинг.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'fonts/*.ttf'],
      manifest: {
        name: 'Журнал спостережень асистента вчителя',
        short_name: 'Журнал асистента',
        description: 'Щоденні спостереження, розклад, експорт і динаміка показників дитини',
        lang: 'uk',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f7f9',
        theme_color: '#0f766e',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ttf,woff2}'],
        // Модулі експорту (react-pdf, docx, xlsx) великі — теж кешуємо для роботи офлайн.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
