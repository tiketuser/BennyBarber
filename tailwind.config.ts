import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import shop from './shop.config';
import { rgbChannels } from './src/lib/color';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1C1917', soft: '#57534E', mute: '#78716C', faint: '#A8A29E' },
        line: { DEFAULT: '#E8E6E1', soft: '#EEEDEA', strong: '#D6D3D1' },
        surface: { DEFAULT: '#F6F5F2', sunk: '#E8E6E1' },
        /**
         * The shop's colors (shop.config.ts): buttons and selected states, and the accent on them. CSS variables, so the
         * trial build can set them at runtime (src/trial/trialShop.ts); every other build keeps its config's colors.
         */
        brand: { DEFAULT: 'rgb(var(--brand) / <alpha-value>)', accent: 'rgb(var(--brand-accent) / <alpha-value>)' },
        open: { DEFAULT: '#059669', soft: '#ECFDF5', line: '#A7F3D0', text: '#047857', dot: '#10B981' },
        danger: { DEFAULT: '#B91C1C', soft: '#FEF2F2', warm: '#FFF4F2' },
        bubble: '#DCF8C6',
        /** Gallery tiles until real photos are uploaded. */
        placeholder: { DEFAULT: '#CFCBC5', ink: '#44403C' },
        /** Unselected bars in the revenue chart. */
        bar: '#918A84',
        /** Desktop backdrop behind the phone frame. */
        desk: '#EFEDE9',
      },
      fontFamily: {
        sans: ['Rubik', 'system-ui', 'sans-serif'],
        brand: ['"Secular One"', 'Rubik', 'sans-serif'],
      },
      borderRadius: { sheet: '28px' },
    },
  },
  plugins: [plugin(({ addBase }) => addBase({ ':root': { '--brand': rgbChannels(shop.colors.brand), '--brand-accent': rgbChannels(shop.colors.accent) } }))],
} satisfies Config;
