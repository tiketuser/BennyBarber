/** "#FFD200" -> "255 210 0", the form the brand CSS variables use (tailwind.config.ts). */
export const rgbChannels = (hex: string) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(' ');
};
