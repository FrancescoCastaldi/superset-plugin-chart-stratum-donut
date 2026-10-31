import { TrendDirection } from '../types';

export const DEFAULT_LOCALE = 'it-IT';
const DASH = '—';

/** Numero da valore SQL: accetta number, bigint e stringhe (anche con virgola decimale). */
export function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'string') {
    const n = Number(val.trim().replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Separatori decimali e delle migliaia per la localita'. Calcolati a mano: non dipendono da ICU. */
export function separatorsOf(locale: string): { group: string; decimal: string } {
  return locale.toLowerCase().startsWith('en') ? { group: ',', decimal: '.' } : { group: '.', decimal: ',' };
}

function groupDigits(intPart: string, group: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

/** Numero con decimali fissi e separatori della localita'. */
export function formatNumber(value: number | null | undefined, decimals = 0, locale = DEFAULT_LOCALE): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const { group, decimal } = separatorsOf(locale);
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, frac] = fixed.split('.');
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  return `${sign}${groupDigits(intPart, group)}${frac !== undefined ? decimal + frac : ''}`;
}

/** Quota in [0, 1] mostrata come percentuale. */
export function formatPercent(share: number | null | undefined, decimals = 1, locale = DEFAULT_LOCALE): string {
  if (share === null || share === undefined || !Number.isFinite(share)) return DASH;
  return `${formatNumber(share * 100, decimals, locale)}%`;
}

function signOf(value: number): string {
  return value > 0 ? '+' : value < 0 ? '-' : '';
}

/** Numero con segno. Un valore che arrotonda a zero non porta il segno (niente "-0,0"). */
export function formatSignedNumber(value: number, decimals = 0, locale = DEFAULT_LOCALE): string {
  const rounded = Number(Math.abs(value).toFixed(decimals));
  const sign = rounded === 0 ? '' : signOf(value);
  return `${sign}${formatNumber(rounded, decimals, locale)}`;
}

/** Variazione in % con segno. Null (base zero) diventa "n.d.". */
export function formatDeltaPct(pct: number | null | undefined, decimals = 1, locale = DEFAULT_LOCALE): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return 'n.d.';
  return `${formatSignedNumber(pct, decimals, locale)}%`;
}

/** Variazione della quota in punti percentuali. */
export function formatPts(pts: number | null | undefined, decimals = 1, locale = DEFAULT_LOCALE): string {
  if (pts === null || pts === undefined || !Number.isFinite(pts)) return 'n.d.';
  return `${formatSignedNumber(pts, decimals, locale)} pt`;
}

export type ArrowStyle = 'triangle' | 'arrow' | 'none';

const TRIANGLE: Record<TrendDirection, string> = { up: '▲', down: '▼', flat: '▬', none: '' };
const ARROW: Record<TrendDirection, string> = { up: '↑', down: '↓', flat: '→', none: '' };

export function trendArrow(trend: TrendDirection, style: ArrowStyle = 'triangle'): string {
  if (style === 'none') return '';
  return style === 'triangle' ? TRIANGLE[trend] : ARROW[trend];
}

export type ValueDisplay = 'value' | 'percent' | 'value_percent';

export interface SliceFormat {
  display: ValueDisplay;
  decimals?: number;
  pctDecimals?: number;
  locale?: string;
  /** Formattatore dei valori (es. d3 di Superset). Se assente si usa formatNumber. */
  valueFormatter?: (n: number) => string;
}

/** Testo del valore di una fetta secondo la scelta dell'utente. */
export function formatSliceValue(value: number | null, share: number | null, f: SliceFormat): string {
  const v = value === null ? DASH : f.valueFormatter ? f.valueFormatter(value) : formatNumber(value, f.decimals ?? 0, f.locale);
  const p = formatPercent(share, f.pctDecimals ?? 1, f.locale);
  if (f.display === 'value') return v;
  if (f.display === 'percent') return p;
  return `${v} · ${p}`;
}
