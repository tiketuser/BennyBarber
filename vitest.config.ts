import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { __SHOP_LOGO_MARK__: 'false', __TRIAL_LOGOS__: '[]' },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
});
