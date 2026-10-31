import { crossFilterMask, drillToDetailFilters, isFilterable, toggleSelection } from '../src/utils/crossFilter';

describe('isFilterable', () => {
  test('valori reali si', () => {
    expect(isFilterable({ key: 'Shipped', raw: 'Shipped' })).toBe(true);
    expect(isFilterable({ key: '0', raw: 0 })).toBe(true);
  });
  test('nulli, Altro e Altri no', () => {
    expect(isFilterable({ key: '<NULL>', raw: null })).toBe(false);
    expect(isFilterable({ key: '__other__', raw: 'x', isOther: true })).toBe(false);
    expect(isFilterable({ key: '__rest__', raw: 'x', isOther: true })).toBe(false);
  });
});

describe('toggleSelection', () => {
  test('aggiunge e toglie senza duplicati', () => {
    const a = { key: 'A', raw: 'A' };
    const b = { key: 'B', raw: 'B' };
    const once = toggleSelection([], a);
    expect(once).toEqual([a]);
    expect(toggleSelection(once, b)).toEqual([a, b]);
    expect(toggleSelection([a, b], a)).toEqual([b]);
  });
});

describe('crossFilterMask', () => {
  test('primo clic: filtro IN con il valore originale', () => {
    const m = crossFilterMask('status', [], { key: 'Shipped', raw: 'Shipped' });
    expect(m).toEqual({
      extraFormData: { filters: [{ col: 'status', op: 'IN', val: ['Shipped'] }] },
      filterState: { value: ['Shipped'], selectedValues: ['Shipped'] },
    });
  });

  test('secondo clic: il filtro somma le selezioni', () => {
    const first = crossFilterMask('status', [], { key: 'A', raw: 'A' })!;
    const sel = [{ key: 'A', raw: 'A' }];
    const second = crossFilterMask('status', sel, { key: 'B', raw: 'B' })!;
    expect(second.extraFormData.filters![0].val).toEqual(['A', 'B']);
    expect(first.filterState.selectedValues).toEqual(['A']);
  });

  test('clic sulla fetta gia\' selezionata la toglie; senza selezioni il filtro scompare', () => {
    const m = crossFilterMask('status', [{ key: 'A', raw: 'A' }], { key: 'A', raw: 'A' })!;
    expect(m.extraFormData).toEqual({});
    expect(m.filterState).toEqual({ value: null, selectedValues: [] });
  });

  test('valori numerici restano numeri nel filtro', () => {
    const m = crossFilterMask('anno', [], { key: '2026', raw: 2026 })!;
    expect(m.extraFormData.filters![0].val).toEqual([2026]);
  });

  test('fetta non filtrabile: nessuna maschera', () => {
    expect(crossFilterMask('status', [], { key: '__other__', raw: 'x', isOther: true })).toBeNull();
    expect(crossFilterMask('status', [], { key: '<NULL>', raw: null })).toBeNull();
  });
});

describe('drillToDetailFilters', () => {
  test('una voce per la fetta cliccata, con etichetta formattata', () => {
    expect(drillToDetailFilters('status', { key: 'A', raw: 'A', label: 'Alfa' })).toEqual([
      { col: 'status', op: '==', val: 'A', formattedVal: 'Alfa' },
    ]);
  });
  test('fetta non filtrabile: nessun drill', () => {
    expect(drillToDetailFilters('status', { key: '__rest__', raw: 'x', label: 'Altri', isOther: true })).toEqual([]);
  });
});
