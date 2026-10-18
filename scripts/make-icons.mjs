// Renders the PWA / app icons from one SVG using the preinstalled Chromium (playwright).
// Colors come from shop.config.ts. Usage: npm run icons
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import shop, { SHOP_ID } from '../shop.config.ts';

const dir = `shops/${SHOP_ID}/public`;
mkdirSync(dir, { recursive: true });

const { brand, accent } = shop.colors;
const SCISSORS = '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>';

const glyph = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${brand}"/>
  <g transform="translate(${pad} ${pad}) scale(${(100 - pad * 2) / 24})" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    ${SCISSORS}
  </g>
</svg>`;

const targets = [
  [`${dir}/pwa-192.png`, 192, 24],
  [`${dir}/pwa-512.png`, 512, 24],
  [`${dir}/pwa-maskable-512.png`, 512, 32],
  [`${dir}/apple-touch-icon.png`, 180, 26],
];

writeFileSync(
  `${dir}/favicon.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${brand}"/><g transform="translate(14 14) scale(1.5)" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SCISSORS}</g></svg>\n`,
);
console.log(`wrote ${dir}/favicon.svg`);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, pad] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${glyph(size, pad)}</body>`);
  writeFileSync(file, await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } }));
  console.log('wrote', file);
}
await browser.close();
