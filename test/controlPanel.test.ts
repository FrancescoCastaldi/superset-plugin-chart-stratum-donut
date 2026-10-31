import controlPanel from '../src/plugin/controlPanel';
import { sliceKeysFromRows, sliceColumnsMapper } from '../src/plugin/controls/sliceConfig';

const controls = (): any[] =>
  (controlPanel.controlPanelSections as any[]).flatMap(section => section.controlSetRows.flat());

const names = () => controls().map((c: any) => c?.name ?? c).filter(Boolean);

describe('control panel', () => {
  test('every plugin-specific control has the dc_ prefix (or is a standard one)', () => {
    const standard = new Set(['metric', 'metrics', 'groupby', 'adhoc_filters', 'row_limit', 'color_scheme', 'number_format']);
    names().forEach((n: string) => {
      if (!standard.has(n)) expect(n.startsWith('dc_')).toBe(true);
    });
  });

  test('no control that requires hand-written JSON', () => {
    controls().forEach((c: any) => {
      expect(c?.config?.language).not.toBe('json');
      expect(c?.config?.type).not.toBe('TextAreaControl');
      expect(c?.config?.type).not.toBe('JSEditorControl');
    });
  });

  test('query controls are not renderTrigger, Customize controls are', () => {
    const query = ['dc_mode', 'metric', 'groupby', 'metrics', 'row_limit', 'dc_exact_total', 'dc_compare_source', 'dc_compare_preset'];
    controls().forEach((c: any) => {
      if (query.includes(c.name)) expect(c.config.renderTrigger).not.toBe(true);
    });
    const custom = controls().find((c: any) => c.name === 'dc_outer_radius');
    expect(custom.config.renderTrigger).toBe(true);
  });

  test('visibility by mode', () => {
    const metric = controls().find((c: any) => c.name === 'metric');
    const metrics = controls().find((c: any) => c.name === 'metrics');
    expect(metric.config.visibility({ controls: { dc_mode: { value: 'column' } } })).toBe(true);
    expect(metric.config.visibility({ controls: { dc_mode: { value: 'metrics' } } })).toBe(false);
    expect(metrics.config.visibility({ controls: { dc_mode: { value: 'metrics' } } })).toBe(true);
  });

  test('the custom range only shows with the custom preset', () => {
    const custom = controls().find((c: any) => c.name === 'dc_compare_custom_range');
    const on = { controls: { dc_compare_source: { value: 'auto' }, dc_compare_preset: { value: 'custom' } } };
    const off = { controls: { dc_compare_source: { value: 'auto' }, dc_compare_preset: { value: 'previous_year' } } };
    expect(custom.config.visibility(on)).toBe(true);
    expect(custom.config.visibility(off)).toBe(false);
  });

  test('grouping thresholds follow the mode', () => {
    const threshold = controls().find((c: any) => c.name === 'dc_other_threshold');
    const topN = controls().find((c: any) => c.name === 'dc_other_top_n');
    expect(threshold.config.visibility({ controls: { dc_other_mode: { value: 'threshold' } } })).toBe(true);
    expect(topN.config.visibility({ controls: { dc_other_mode: { value: 'threshold' } } })).toBe(false);
  });
});

describe('per-slice configuration', () => {
  test('distinct keys in order of appearance, null values included', () => {
    const keys = sliceKeysFromRows([{ s: 'A' }, { s: 'B' }, { s: 'A' }, { s: null }], 's');
    expect(keys).toEqual(['A', 'B', '<NULL>']);
  });

  test('metrics mode: the columns are the metrics', () => {
    const explore = { controls: { dc_mode: { value: 'metrics' }, metrics: { value: ['SUM(a)', { label: 'Count' }] } } };
    const out = sliceColumnsMapper(explore, null, null);
    expect(out.columnsPropsObject.colnames).toEqual(['SUM(a)', 'Count']);
    expect(out.columnsPropsObject.coltypes).toEqual([0, 0]);
  });

  test('column mode: the columns are the dimension values in the queries', () => {
    const explore = { controls: { dc_mode: { value: 'column' }, groupby: { value: ['status'] } } };
    const chart = { queriesResponse: [{ data: [{ status: 'Shipped' }, { status: 'Cancelled' }] }] };
    expect(sliceColumnsMapper(explore, null, chart).columnsPropsObject.colnames).toEqual(['Shipped', 'Cancelled']);
  });
});
