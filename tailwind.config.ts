import type { Config } from 'tailwindcss';
import shop from './shop.config';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1C1917', soft: '#57534E', mute: '#78716C', faint: '#A8A29E' },
        line: { DEFAULT: '#E8E6E1', soft: '#EEEDEA', strong: '#D6D3D1' },
        surface: { DEFAULT: '#F6F5F2', sunk: '#E8E6E1' },
        /** The shop's colors (shop.config.ts): buttons and selected states, and the accent on them. */
        brand: { DEFAULT: shop.colors.brand, accent: shop.colors.accent },
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
  plugins: [],
} satisfies Config;
