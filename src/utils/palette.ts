/** Slice palette. The color depends on the position in the chart, so neighbouring slices stay distinct. */
export const DEFAULT_PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#17becf', '#bcbd22', '#7f7f7f',
];

/** Color by index: the first slices get different colors, even when their keys collide. */
export function paletteColor(_key: string, index: number): string {
  return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
}
