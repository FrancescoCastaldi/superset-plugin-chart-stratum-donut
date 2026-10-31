import { TrendDirection } from '../types';

export const DEFAULT_LOCALE = 'en-US';
const DASH = '-';

/** Number from an SQL value: accepts number, bigint and strings (also with a decimal comma). */
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

/** Decimal and thousands separators for the locale. Computed by hand: they do not depend on ICU. */
export function separatorsOf(locale: string): { group: string; decimal: string } {
  return locale.toLowerCase().startsWith('en') ? { group: ',', decimal: '.' } : { group: '.', decimal: ',' };
}

function groupDigits(intPart: string, group: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

/** Number with fixed decimals and the locale separators. */
export function formatNumber(value: number | null | undefined, decimals = 0, locale = DEFAULT_LOCALE): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const { group, decimal } = separatorsOf(locale);
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, frac] = fixed.split('.');
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  return `${sign}${groupDigits(intPart, group)}${frac !== undefined ? decimal + frac : ''}`;
}

/** Share in [0, 1] shown as a percentage. */
export function formatPercent(share: number | null | undefined, decimals = 1, locale = DEFAULT_LOCALE): string {
  if (share === null || share === undefined || !Number.isFinite(share)) return DASH;
  return `${formatNumber(share * 100, decimals, locale)}%`;
}

function signOf(value: number): string {
  return value > 0 ? '+' : value < 0 ? '-' : '';
}

/** Signed number. A value that rounds to zero carries no sign (no "-0.0"). */
export function formatSignedNumber(value: number, decimals = 0, locale = DEFAULT_LOCALE): string {
  const rounded = Number(Math.abs(value).toFixed(decimals));
  const sign = rounded === 0 ? '' : signOf(value);
  return `${sign}${formatNumber(rounded, decimals, locale)}`;
}

/** Signed percentage change. Null (zero base) becomes "n/a". */
export function formatDeltaPct(pct: number | null | undefined, decimals = 1, locale = DEFAULT_LOCALE): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return 'n/a';
  return `${formatSignedNumber(pct, decimals, locale)}%`;
}

/** Change of the share in percentage points. */
export function formatPts(pts: number | null | undefined, decimals = 1, locale = DEFAULT_LOCALE): string {
  if (pts === null || pts === undefined || !Number.isFinite(pts)) return 'n/a';
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
  /** Value formatter (e.g. Superset's d3). If missing, formatNumber is used. */
  valueFormatter?: (n: number) => string;
}

/** Text of a slice's value, according to the user's choice. */
export function formatSliceValue(value: number | null, share: number | null, f: SliceFormat): string {
  const v = value === null ? DASH : f.valueFormatter ? f.valueFormatter(value) : formatNumber(value, f.decimals ?? 0, f.locale);
  const p = formatPercent(share, f.pctDecimals ?? 1, f.locale);
  if (f.display === 'value') return v;
  if (f.display === 'percent') return p;
  return `${v} · ${p}`;
}
