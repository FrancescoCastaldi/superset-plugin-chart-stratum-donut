import { Granularity, PeriodInfo, PeriodRange } from '../types';

export const IT_MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
export const IT_MONTHS_LONG = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const DAY_MS = 86_400_000;
const NO_FILTER = new Set(['', 'no filter', 'nessun filtro']);

function parseBound(text: string): Date | null {
  const t = text.trim();
  if (!t) return null;
  // Data semplice YYYY-MM-DD: sempre UTC, per non spostare il giorno con il fuso.
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Interpreta un intervallo Superset esplicito: "A : B" (separatore del filtro
 * PeriodCompare) o "A:B" con date ISO. Restituisce null per intervalli relativi
 * ("Last month", "previous calendar year", ...) o non interpretabili.
 */
export function parseTimeRange(raw: string | null | undefined): PeriodRange | null {
  if (!raw || NO_FILTER.has(raw.trim().toLowerCase())) return null;
  let parts = raw.split(' : ');
  if (parts.length !== 2) {
    // "2026-10-01:2026-11-01" o con orari ISO: il separatore e' il ':' tra due date.
    const m = raw.match(/^\s*(\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?)\s*:\s*(\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?)\s*$/);
    if (!m) return null;
    parts = [m[1], m[2]];
  }
  const start = parseBound(parts[0]);
  const end = parseBound(parts[1]);
  if (!start || !end || end.getTime() <= start.getTime()) return null;
  return { start, end };
}

function isMidnight(d: Date): boolean {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));
}

/** Riconosce la granularita' di un intervallo semi-aperto. */
export function detectGranularity(range: PeriodRange): Granularity {
  const { start, end } = range;
  if (!isMidnight(start) || !isMidnight(end)) return 'custom';
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const firstOfMonth = start.getUTCDate() === 1;
  if (firstOfMonth && start.getUTCMonth() === 0 && addMonths(start, 12).getTime() === end.getTime()) return 'year';
  if (firstOfMonth && start.getUTCMonth() % 3 === 0 && addMonths(start, 3).getTime() === end.getTime()) return 'quarter';
  if (firstOfMonth && addMonths(start, 1).getTime() === end.getTime()) return 'month';
  if (days === 7 && start.getUTCDay() === 1) return 'week';
  if (days === 1) return 'day';
  return 'custom';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateIt(d: Date): string {
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Numero di settimana ISO 8601. */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

export type MonthStyle = 'short' | 'long';

/** Etichetta italiana in base alla granularita'. La fine e' esclusa: si mostra il giorno prima. */
export function labelForRange(range: PeriodRange, monthStyle: MonthStyle = 'short'): string {
  const g = detectGranularity(range);
  const { start } = range;
  const months = monthStyle === 'long' ? IT_MONTHS_LONG : IT_MONTHS_SHORT;
  const lastDay = new Date(range.end.getTime() - (isMidnight(range.end) ? DAY_MS : 0));
  switch (g) {
    case 'year':
      return `${start.getUTCFullYear()}`;
    case 'quarter':
      return `T${start.getUTCMonth() / 3 + 1} ${start.getUTCFullYear()}`;
    case 'month':
      return `${months[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
    case 'week':
      return `Sett. ${isoWeek(start)} ${start.getUTCFullYear()}`;
    case 'day':
      return formatDateIt(start);
    default:
      return `${formatDateIt(start)} - ${formatDateIt(lastDay)}`;
  }
}

/** Informazioni complete su un periodo, a partire dalla stringa ricevuta. */
export function describePeriod(
  raw: string | null | undefined,
  fallbackLabel: string,
  monthStyle: MonthStyle = 'short',
): PeriodInfo {
  const range = parseTimeRange(raw ?? null);
  if (!range) {
    const relative = raw && !NO_FILTER.has(raw.trim().toLowerCase()) ? raw.trim() : null;
    return { raw: raw ?? null, range: null, granularity: null, label: relative ?? fallbackLabel };
  }
  return { raw: raw ?? null, range, granularity: detectGranularity(range), label: labelForRange(range, monthStyle) };
}

/** Formatta un intervallo come lo accetta Superset: "YYYY-MM-DD : YYYY-MM-DD". */
export function toTimeRangeString(range: PeriodRange): string {
  const f = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return `${f(range.start)} : ${f(range.end)}`;
}

export type ComparisonPreset = 'previous_period' | 'previous_year';

/** Periodo di confronto calcolato dal riferimento esplicito (stessa logica del filtro PeriodCompare). */
export function shiftRange(range: PeriodRange, preset: ComparisonPreset): PeriodRange {
  if (preset === 'previous_year') {
    return { start: addMonthsClamped(range.start, -12), end: addMonthsClamped(range.end, -12) };
  }
  const { start, end } = range;
  if (start.getUTCDate() === 1 && end.getUTCDate() === 1 && isMidnight(start) && isMidnight(end)) {
    const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
    return { start: addMonthsClamped(start, -months), end: new Date(start.getTime()) };
  }
  const len = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - len), end: new Date(start.getTime()) };
}

function addMonthsClamped(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
}
