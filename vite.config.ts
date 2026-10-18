import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import shop, { SHOP_ID } from './shop.config';

const description = `קביעת תור ל${shop.fullName}, ${shop.address.street} ${shop.address.city}`;

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // The app gets only this build's shop (SHOP env), never the list of all shops.
      { find: /^(\.\.?\/)+shop\.config(\.ts)?$/, replacement: fileURLToPath(new URL(`./shops/${SHOP_ID}/config.ts`, import.meta.url)) },
    ],
  },
  // Each shop's icons: shops/<id>/public (npm run icons).
  publicDir: `shops/${SHOP_ID}/public`,
  plugins: [
    react(),
    {
      // Fills the shop's name into index.html (%SHOP_FULL_NAME% etc.).
      name: 'shop-html',
      transformIndexHtml: (html) => html.replaceAll('%SHOP_FULL_NAME%', shop.fullName).replaceAll('%SHOP_BRAND%', shop.brand).replaceAll('%SHOP_DESCRIPTION%', description),
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: shop.fullName,
        short_name: shop.brand,
        description,
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
});
