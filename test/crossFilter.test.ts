import { crossFilterMask, drillToDetailFilters, isFilterable, toggleSelection } from '../src/utils/crossFilter';

describe('isFilterable', () => {
  test('real values are filterable', () => {
    expect(isFilterable({ key: 'Shipped', raw: 'Shipped' })).toBe(true);
    expect(isFilterable({ key: '0', raw: 0 })).toBe(true);
  });
  test('nulls, Other and Others are not', () => {
    expect(isFilterable({ key: '<NULL>', raw: null })).toBe(false);
    expect(isFilterable({ key: '__other__', raw: 'x', isOther: true })).toBe(false);
    expect(isFilterable({ key: '__rest__', raw: 'x', isOther: true })).toBe(false);
  });
});

describe('toggleSelection', () => {
  test('adds and removes without duplicates', () => {
    const a = { key: 'A', raw: 'A' };
    const b = { key: 'B', raw: 'B' };
    const once = toggleSelection([], a);
    expect(once).toEqual([a]);
    expect(toggleSelection(once, b)).toEqual([a, b]);
    expect(toggleSelection([a, b], a)).toEqual([b]);
  });
});

describe('crossFilterMask', () => {
  test('first click: IN filter with the original value', () => {
    const m = crossFilterMask('status', [], { key: 'Shipped', raw: 'Shipped' });
    expect(m).toEqual({
      extraFormData: { filters: [{ col: 'status', op: 'IN', val: ['Shipped'] }] },
      filterState: { value: ['Shipped'], selectedValues: ['Shipped'] },
    });
  });

  test('second click: the filter adds up the selections', () => {
    const first = crossFilterMask('status', [], { key: 'A', raw: 'A' })!;
    const sel = [{ key: 'A', raw: 'A' }];
    const second = crossFilterMask('status', sel, { key: 'B', raw: 'B' })!;
    expect(second.extraFormData.filters![0].val).toEqual(['A', 'B']);
    expect(first.filterState.selectedValues).toEqual(['A']);
  });

  test('clicking an already selected slice removes it; with no selection the filter disappears', () => {
    const m = crossFilterMask('status', [{ key: 'A', raw: 'A' }], { key: 'A', raw: 'A' })!;
    expect(m.extraFormData).toEqual({});
    expect(m.filterState).toEqual({ value: null, selectedValues: [] });
  });

  test('numeric values stay numbers in the filter', () => {
    const m = crossFilterMask('anno', [], { key: '2026', raw: 2026 })!;
    expect(m.extraFormData.filters![0].val).toEqual([2026]);
  });

  test('non-filterable slice: no mask', () => {
    expect(crossFilterMask('status', [], { key: '__other__', raw: 'x', isOther: true })).toBeNull();
    expect(crossFilterMask('status', [], { key: '<NULL>', raw: null })).toBeNull();
  });
});

describe('drillToDetailFilters', () => {
  test('one entry for the clicked slice, with the formatted label', () => {
    expect(drillToDetailFilters('status', { key: 'A', raw: 'A', label: 'Alpha' })).toEqual([
      { col: 'status', op: '==', val: 'A', formattedVal: 'Alpha' },
    ]);
  });
  test('non-filterable slice: no drill', () => {
    expect(drillToDetailFilters('status', { key: '__rest__', raw: 'x', label: 'Others', isOther: true })).toEqual([]);
  });
});
