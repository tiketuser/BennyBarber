// Renders the PWA / app icons from one SVG using the preinstalled Chromium (playwright).
// Usage: npm run icons
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const glyph = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#111111"/>
  <g transform="translate(${pad} ${pad}) scale(${(100 - pad * 2) / 24})" fill="none" stroke="#FFD200" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>
  </g>
</svg>`;

const targets = [
  ['public/pwa-192.png', 192, 24],
  ['public/pwa-512.png', 512, 24],
  ['public/pwa-maskable-512.png', 512, 32],
  ['public/apple-touch-icon.png', 180, 26],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, pad] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${glyph(size, pad)}</body>`);
  writeFileSync(file, await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } }));
  console.log('wrote', file);
}
await browser.close();
