import { formatDeltaPct, formatNumber, formatPercent, formatPts, formatSliceValue, trendArrow } from '../src/utils/format';
import { periodFromBounds } from '../src/utils/periodLabel';

describe('formati it-IT', () => {
  test('numeri con separatore delle migliaia', () => {
    expect(formatNumber(1240)).toBe('1.240');
    expect(formatNumber(1234.567, 1)).toBe('1.234,6');
    expect(formatNumber(null)).toBe('—');
  });

  test('quote e variazioni', () => {
    expect(formatPercent(0.82, 1)).toBe('82,0%');
    expect(formatDeltaPct(4.1, 1)).toBe('+4,1%');
    expect(formatDeltaPct(-2, 1)).toBe('-2,0%');
    expect(formatDeltaPct(null)).toBe('n.d.');
    expect(formatPts(-2, 1)).toBe('-2,0 pt');
    expect(formatPts(4.14, 1)).toBe('+4,1 pt');
    expect(formatPts(-0.04, 1)).toBe('0,0 pt');
  });

  test('frecce per trend', () => {
    expect(trendArrow('up', 'triangle')).toBe('▲');
    expect(trendArrow('down', 'arrow')).toBe('↓');
    expect(trendArrow('up', 'none')).toBe('');
  });

  test('valore secondo la scelta: valore, percentuale, entrambi', () => {
    expect(formatSliceValue(1240, 0.82, { display: 'value' })).toBe('1.240');
    expect(formatSliceValue(1240, 0.82, { display: 'percent' })).toBe('82,0%');
    expect(formatSliceValue(1240, 0.82, { display: 'value_percent' })).toBe('1.240 · 82,0%');
  });

  test('formattatore esterno (es. d3 di Superset) prevale', () => {
    expect(formatSliceValue(1240, null, { display: 'value', valueFormatter: n => `€${n}` })).toBe('€1240');
  });
});

describe('periodFromBounds', () => {
  test('mese intero', () => {
    expect(periodFromBounds(Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), 'x').label).toBe('Ott 2026');
  });
  test('stile lungo', () => {
    expect(periodFromBounds(Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1), 'x', 'long').label).toBe('Ottobre 2026');
  });
  test('limite aperto', () => {
    expect(periodFromBounds(null, Date.UTC(2026, 10, 1), 'x')).toMatchObject({ granularity: 'open_end' });
    expect(periodFromBounds(Date.UTC(2026, 9, 1), null, 'x').label).toMatch(/^dal 01\/10\/2026$/);
  });
  test('nessun limite', () => {
    expect(periodFromBounds(null, null, 'x').label).toBe('Tutto il periodo');
  });
  test('intervallo non valido: etichetta di riserva', () => {
    expect(periodFromBounds(Date.UTC(2026, 10, 1), Date.UTC(2026, 9, 1), 'Riferimento').label).toBe('Riferimento');
  });
});
