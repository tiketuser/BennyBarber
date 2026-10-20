import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import shop, { SHOP_ID } from './shop.config';

// The trial build (shops/trial) serves every trial barber from one site and reads the shop at runtime (src/trial).
// Node scripts run through vite-node (scripts/demo-data.ts) set SHOP_STATIC=1 to get the plain config instead.
const trial = !!shop.trial && !process.env.SHOP_STATIC;

const description = `קביעת תור ל${shop.fullName}, ${shop.address.street} ${shop.address.city}`;

export default defineConfig({
  define: { __SHOP_LOGO_MARK__: JSON.stringify(existsSync(`shops/${SHOP_ID}/public/logo-mark.svg`)) },
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // The app gets only this build's shop (SHOP env), never the list of all shops.
      {
        find: /^(\.\.?\/)+shop\.config(\.ts)?$/,
        replacement: fileURLToPath(new URL(trial ? './src/trial/trialShop.ts' : `./shops/${SHOP_ID}/config.ts`, import.meta.url)),
      },
    ],
  },
  // Each shop's icons: shops/<id>/public (npm run icons).
  publicDir: `shops/${SHOP_ID}/public`,
  // The trial loader waits for the shop's details at the top level (Safari 15+).
  build: trial ? { target: ['es2022', 'safari15'] } : undefined,
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
      // The trial build writes each shop's manifest at runtime (src/trial/trialShop.ts).
      manifest: trial
        ? false
        : {
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
