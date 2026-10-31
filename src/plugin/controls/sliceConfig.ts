import { columnNameOf, metricLabelOf, normalizeKey } from '../../utils/rows';

const t = (s: string) => s;

/** Distinct slice keys, in order of appearance, from the rows of a query. */
export function sliceKeysFromRows(data: Record<string, any>[], column: string): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  data.forEach(row => {
    const key = normalizeKey(row[column]);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  });
  return keys;
}

/**
 * Columns shown by the per-slice control. In metrics mode they are the metrics;
 * in column mode they are the values of the dimension in the queries already run.
 */
export function sliceColumnsMapper(explore: any, _value: unknown, chart: any): { columnsPropsObject: { colnames: string[]; coltypes: number[] } } {
  const controls = explore?.controls ?? {};
  let colnames: string[] = [];
  if (controls.dc_mode?.value === 'metrics') {
    colnames = (controls.metrics?.value ?? []).map(metricLabelOf).filter(Boolean);
  } else {
    const column = columnNameOf((controls.groupby?.value ?? [])[0]);
    const data: Record<string, any>[] = chart?.queriesResponse?.[0]?.data ?? [];
    colnames = column ? sliceKeysFromRows(data, column) : [];
  }
  return { columnsPropsObject: { colnames, coltypes: colnames.map(() => 0) } };
}

const POLARITY_OPTIONS = [
  ['inherit', t('Inherit')],
  ['higher_is_better', t('Higher is better')],
  ['lower_is_better', t('Lower is better')],
  ['neutral', t('Neutral')],
];

const VALUE_MODE_OPTIONS = [
  ['inherit', t('Inherit')],
  ['value', t('Value')],
  ['percent', t('Percentage')],
  ['value_percent', t('Value and percentage')],
];

/** Colors from the Superset theme or picked from a palette: no hex code to type. */
export const COLOR_CHOICES = [
  ['', t('Automatic')],
  ['#1f77b4', t('Blue')],
  ['#ff7f0e', t('Orange')],
  ['#2ca02c', t('Green')],
  ['#d62728', t('Red')],
  ['#9467bd', t('Purple')],
  ['#8c564b', t('Brown')],
  ['#e377c2', t('Pink')],
  ['#17becf', t('Cyan')],
  ['#bcbd22', t('Olive')],
  ['#7f7f7f', t('Grey')],
];

/**
 * Per-slice control. The layout uses tabs: general (name, visibility, color, polarity)
 * and format (value, decimals). The saved value is an object keyed by slice key.
 */
export const sliceConfigControl = {
  type: 'ColumnConfigControl',
  label: t('Slices: name, color, format, polarity'),
  description: t('Customize each slice. Changes apply to the slice key, so they persist even if the order changes.'),
  default: {},
  renderTrigger: true,
  width: 440,
  height: 380,
  shouldMapStateToProps: () => true,
  mapStateToProps: sliceColumnsMapper,
  // Layout per column type: 0 = Numeric (GenericDataType).
  configFormLayout: {
    0: [
      {
        tab: t('General'),
        children: [
          ['customColumnName', 'visible'],
          [
            {
              name: 'dc_color',
              config: { type: 'Select', label: t('Color'), default: '', clearable: true, choices: COLOR_CHOICES },
            },
          ],
          [
            {
              name: 'dc_polarity',
              config: { type: 'RadioButtonControl', label: t('Meaning of the change'), default: 'inherit', options: POLARITY_OPTIONS },
            },
          ],
        ],
      },
      {
        tab: t('Format'),
        children: [
          [
            {
              name: 'dc_value_mode',
              config: { type: 'RadioButtonControl', label: t('Show'), default: 'inherit', options: VALUE_MODE_OPTIONS },
            },
          ],
          ['d3NumberFormat', 'currencyFormat'],
        ],
      },
    ],
  },
};
