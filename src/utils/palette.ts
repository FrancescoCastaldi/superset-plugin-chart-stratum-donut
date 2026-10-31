/** Palette di riserva per le fette, usata quando Superset non fornisce un colore. */
export const DEFAULT_PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#17becf', '#bcbd22', '#7f7f7f',
];

/** Colore deterministico per chiave: la stessa fetta ha sempre lo stesso colore. */
export function paletteColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return DEFAULT_PALETTE[h % DEFAULT_PALETTE.length];
}
