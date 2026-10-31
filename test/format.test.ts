import { formatDeltaPct, formatNumber, formatPercent, formatPts, formatSliceValue, trendArrow } from '../src/utils/format';
import { periodFromBounds } from '../src/utils/periodLabel';

describe('formats (en-US)', () => {
  test('numbers with thousands separator', () => {
    expect(formatNumber(1240)).toBe('1,240');
    expect(formatNumber(1234.567, 1)).toBe('1,234.6');
    expect(formatNumber(null)).toBe('-');
  });

  test('shares and changes', () => {
    expect(formatPercent(0.82, 1)).toBe('82.0%');
    expect(formatDeltaPct(4.1, 1)).toBe('+4.1%');
    expect(formatDeltaPct(-2, 1)).toBe('-2.0%');
    expect(formatDeltaPct(null)).toBe('n/a');
    expect(formatPts(-2, 1)).toBe('-2.0 pt');
    expect(formatPts(4.14, 1)).toBe('+4.1 pt');
    expect(formatPts(-0.04, 1)).toBe('0.0 pt');
  });

  test('arrows for trend', () => {
    expect(trendArrow('up', 'triangle')).toBe('▲');
    expect(trendArrow('down', 'arrow')).toBe('↓');
    expect(trendArrow('up', 'none')).toBe('');
  });

  test('value according to the choice: value, percentage, both', () => {
    expect(formatSliceValue(1240, 0.82, { display: 'value' })).toBe('1,240');
    expect(formatSliceValue(1240, 0.82, { display: 'percent' })).toBe('82.0%');
    expect(formatSliceValue(1240, 0.82, { display: 'value_percent' })).toBe('1,240 · 82.0%');
  });

  test('external formatter (e.g. Superset d3) takes precedence', () => {
    expect(formatSliceValue(1240, null, { display: 'value', valueFormatter: n => `€${n}` })).toBe('€1240');
  });
});

describe('periodFromBounds', () => {
  test('whole month', () => {
    expect(periodFromBounds(Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), 'x').label).toBe('Oct 2026');
  });
  test('long style', () => {
    expect(periodFromBounds(Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), 'x', 'long').label).toBe('October 2026');
  });
  test('open bound', () => {
    expect(periodFromBounds(null, Date.UTC(2026, 10, 1), 'x')).toMatchObject({ granularity: 'open_end' });
    expect(periodFromBounds(Date.UTC(2026, 9, 1), null, 'x').label).toBe('from 2026-10-01');
  });
  test('no bounds', () => {
    expect(periodFromBounds(null, null, 'x').label).toBe('Full period');
  });
  test('invalid range: fallback label', () => {
    expect(periodFromBounds(Date.UTC(2026, 10, 1), Date.UTC(2026, 9, 1), 'Reference').label).toBe('Reference');
  });
});
