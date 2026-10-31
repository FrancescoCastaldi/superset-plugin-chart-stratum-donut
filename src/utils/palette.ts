/** Palette delle fette. Il colore dipende dalla posizione nel grafico, cosi' fette vicine restano distinte. */
export const DEFAULT_PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#17becf', '#bcbd22', '#7f7f7f',
];

/** Colore per indice: le prime fette ricevono colori diversi, anche se le chiavi collidono. */
export function paletteColor(_key: string, index: number): string {
  return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
}
