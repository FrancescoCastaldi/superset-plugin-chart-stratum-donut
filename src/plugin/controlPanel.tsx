import { ControlPanelConfig, sharedControls } from '@superset-ui/chart-controls';
import { sliceConfigControl } from './controls/sliceConfig';

const t = (str: string) => str;

const modeIs = (mode: 'column' | 'metrics') => ({ controls }: any) => controls?.dc_mode?.value === mode;
const compareSourceIs = (...sources: string[]) => ({ controls }: any) => sources.includes(controls?.dc_compare_source?.value);
const presetIs = (preset: string) => ({ controls }: any) => controls?.dc_compare_preset?.value === preset;
const otherModeIs = (mode: string) => ({ controls }: any) => controls?.dc_other_mode?.value === mode;

/** Temporal columns of the dataset, to choose the one used for the period. */
function temporalChoices({ datasource }: any) {
  const columns: any[] = datasource?.columns ?? [];
  return {
    choices: columns.filter(c => c.is_dttm).map(c => [c.column_name, c.verbose_name || c.column_name]),
  };
}

const slider = (label: string, min: number, max: number, step: number, def: number, extra: Record<string, unknown> = {}) => ({
  type: 'SliderControl',
  label: t(label),
  min,
  max,
  step,
  default: def,
  renderTrigger: true,
  ...extra,
});

const select = (label: string, choices: [string, string][], def: string, extra: Record<string, unknown> = {}) => ({
  type: 'SelectControl',
  label: t(label),
  choices,
  default: def,
  clearable: false,
  renderTrigger: true,
  ...extra,
});

const checkbox = (label: string, def: boolean, extra: Record<string, unknown> = {}) => ({
  type: 'CheckboxControl',
  label: t(label),
  default: def,
  renderTrigger: true,
  ...extra,
});

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Data'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'dc_mode',
            config: {
              type: 'RadioButtonControl',
              label: t('Slices from'),
              default: 'column',
              options: [
                ['column', t('Column (each value is a slice)')],
                ['metrics', t('Metrics (each metric is a slice)')],
              ],
            },
          },
        ],
        [{ name: 'metric', config: { ...sharedControls.metric, label: t('Metric'), validators: [], visibility: modeIs('column') } }],
        [
          {
            name: 'groupby',
            config: { ...sharedControls.groupby, label: t('Dimension (slices)'), multi: false, validators: [], visibility: modeIs('column') },
          },
        ],
        [{ name: 'metrics', config: { ...sharedControls.metrics, label: t('Metrics (slices)'), validators: [], visibility: modeIs('metrics') } }],
        [
          {
            name: 'dc_total_metric',
            config: {
              type: 'SelectControl',
              label: t('Total metric (optional)'),
              description: t('Denominator for the shares. If empty, the total is the sum of the slices.'),
              default: null,
              clearable: true,
              validators: [],
              visibility: modeIs('metrics'),
            },
          },
        ],
        ['adhoc_filters'],
        [
          {
            name: 'dc_time_column',
            config: {
              type: 'SelectControl',
              label: t('Period time column'),
              description: t('Used to apply the reference and comparison periods.'),
              default: null,
              clearable: true,
              mapStateToProps: temporalChoices,
            },
          },
        ],
        [
          {
            name: 'row_limit',
            config: {
              type: 'SelectControl',
              label: t('Row limit'),
              default: 100,
              choices: [[10, '10'], [25, '25'], [50, '50'], [100, '100'], [250, '250'], [500, '500'], [1000, '1000']],
              visibility: modeIs('column'),
            },
          },
        ],
        [
          {
            name: 'dc_exact_total',
            config: {
              type: 'CheckboxControl',
              label: t('Exact total (dedicated query)'),
              description: t('Use the real total even when the row limit hides some slices.'),
              default: false,
              visibility: modeIs('column'),
            },
          },
        ],
        [
          {
            name: 'emit_filter',
            config: checkbox('Enable cross-filtering', true, {
              description: t('Clicking a slice filters the other charts on the dashboard.'),
            }),
          },
        ],
      ],
    },
    {
      label: t('Period comparison'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'dc_compare_source',
            config: {
              type: 'SelectControl',
              label: t('Compare from'),
              default: 'auto',
              clearable: false,
              choices: [
                ['auto', t('Dashboard filter, otherwise the preset')],
                ['dashboard', t('Dashboard filter only')],
                ['chart', t('Chart preset only')],
                ['none', t('No comparison')],
              ],
            },
          },
        ],
        [
          {
            name: 'dc_compare_preset',
            config: {
              type: 'SelectControl',
              label: t('Comparison period'),
              description: t('Calculated on the reference period. With a dashboard filter, its comparison takes precedence.'),
              default: 'previous_period',
              clearable: false,
              choices: [
                ['previous_period', t('Previous period of the same length')],
                ['previous_week', t('Previous week')],
                ['previous_month', t('Previous month')],
                ['previous_quarter', t('Previous quarter')],
                ['previous_year', t('Previous year')],
                ['same_weekday_last_year', t('Same weekday, one year ago')],
                ['custom', t('Custom range')],
              ],
              visibility: compareSourceIs('auto', 'chart'),
            },
          },
        ],
        [
          {
            name: 'dc_compare_custom_range',
            config: {
              type: 'DateFilterControl',
              label: t('Comparison range'),
              default: 'No filter',
              visibility: ({ controls }: any) => compareSourceIs('auto', 'chart')({ controls }) && presetIs('custom')({ controls }),
            },
          },
        ],
      ],
    },
    {
      label: t('Periods and rings'),
      expanded: false,
      controlSetRows: [
        [{ name: 'dc_ref_label', config: { type: 'TextControl', label: t('Reference label'), default: '', renderTrigger: true } }],
        [{ name: 'dc_cmp_label', config: { type: 'TextControl', label: t('Comparison label'), default: '', renderTrigger: true } }],
        [
          {
            name: 'dc_period_style',
            config: select('Period style', [['short', t('Short: Oct 2026')], ['long', t('Long: October 2026')]], 'short'),
          },
        ],
        [{ name: 'dc_outer_radius', config: slider('Outer radius (%)', 40, 100, 1, 85) }],
        [{ name: 'dc_ring_width', config: slider('Ring width (%)', 5, 40, 1, 25) }],
        [
          {
            name: 'dc_inner_ring_width',
            config: slider('Inner ring width (0 = same)', 0, 40, 1, 0),
          },
        ],
        [{ name: 'dc_ring_gap', config: slider('Gap between rings (%)', 0, 15, 1, 3) }],
        [{ name: 'dc_start_angle', config: slider('Start angle', 0, 360, 1, 90) }],
        [
          {
            name: 'dc_cmp_style',
            config: select('Comparison ring style', [['faded', t('Faded')], ['solid', t('Solid')]], 'faded'),
          },
        ],
      ],
    },
    {
      label: t('Labels'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'dc_label_rings',
            config: select('Rings with labels', [['outer', t('Outer only')], ['both', t('Both')], ['none', t('None')]], 'outer'),
          },
        ],
        [
          {
            name: 'dc_label_content',
            config: select(
              'Content',
              [
                ['percent', t('Percentage')],
                ['value', t('Value')],
                ['value_percent', t('Value and percentage')],
                ['name_percent', t('Name and percentage')],
                ['name_value_percent', t('Name, value and percentage')],
                ['percent_delta', t('Percentage and change')],
              ],
              'name_percent',
            ),
          },
        ],
        [
          {
            name: 'dc_label_position',
            config: select('Position', [['outside', t('Outside')], ['inside', t('Inside')]], 'outside'),
          },
        ],
        [{ name: 'dc_label_min_share', config: slider('Label only above (%)', 0, 10, 0.5, 3) }],
      ],
    },
    {
      label: t('Slices'),
      expanded: false,
      controlSetRows: [[{ name: 'dc_slice_config', config: sliceConfigControl }]],
    },
    {
      label: t('Grouping and order'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'dc_other_mode',
            config: select('Small slices', [['threshold', t('Below a threshold')], ['top_n', t('Only the top N')], ['none', t('No grouping')]], 'threshold'),
          },
        ],
        [
          {
            name: 'dc_other_threshold',
            config: slider('Threshold (%)', 0, 20, 0.5, 2, { visibility: otherModeIs('threshold') }),
          },
        ],
        [
          {
            name: 'dc_other_top_n',
            config: slider('Slices to keep (N)', 2, 30, 1, 8, { visibility: otherModeIs('top_n') }),
          },
        ],
        [{ name: 'dc_other_label', config: { type: 'TextControl', label: t('Group name'), default: 'Other', renderTrigger: true } }],
        [
          {
            name: 'dc_sort',
            config: select(
              'Slice order',
              [['auto', t('Automatic')], ['ref_desc', t('Value, descending')], ['ref_asc', t('Value, ascending')], ['name_asc', t('Name')]],
              'auto',
            ),
          },
        ],
        [{ name: 'dc_hide_zero_slices', config: checkbox('Hide zero slices', true) }],
      ],
    },
    {
      label: t('Legend and center'),
      expanded: false,
      controlSetRows: [
        [{ name: 'dc_legend_show', config: checkbox('Show legend', true) }],
        [
          {
            name: 'dc_legend_position',
            config: select('Legend position', [['right', t('Right')], ['bottom', t('Bottom')]], 'right'),
          },
        ],
        [
          {
            name: 'dc_legend_columns',
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('Legend columns'),
              default: ['value', 'share', 'delta'],
              choices: [['value', t('Value')], ['share', t('Share')], ['delta', t('Change')]],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'dc_center_content',
            config: select(
              'Center text',
              [['ref_total_delta', t('Total and change')], ['ref_total', t('Total only')], ['none', t('None')]],
              'ref_total_delta',
            ),
          },
        ],
        [{ name: 'dc_center_caption', config: { type: 'TextControl', label: t('Center title'), default: 'Total', renderTrigger: true } }],
      ],
    },
    {
      label: t('Tooltip, change and formats'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'dc_tooltip_items',
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('Tooltip items'),
              default: ['values', 'shares', 'delta_pct', 'delta_pts'],
              choices: [
                ['values', t('Values of both periods')],
                ['shares', t('Shares')],
                ['delta_abs', t('Absolute difference')],
                ['delta_pct', t('Change %')],
                ['delta_pts', t('Share change in points')],
              ],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'dc_default_polarity',
            config: select(
              'Default meaning of a change',
              [['higher_is_better', t('Higher is better')], ['lower_is_better', t('Lower is better')], ['neutral', t('Neutral')]],
              'higher_is_better',
            ),
          },
        ],
        [
          {
            name: 'dc_delta_arrows',
            config: select('Arrows', [['triangle', '▲ ▼'], ['arrow', '↑ ↓'], ['none', t('None')]], 'triangle'),
          },
        ],
        [{ name: 'dc_delta_decimals', config: slider('Change decimals', 0, 3, 1, 1) }],
        [{ name: 'color_scheme', config: { ...sharedControls.color_scheme, renderTrigger: true } }],
        [{ name: 'number_format', config: { ...sharedControls.y_axis_format, label: t('Value format'), default: 'SMART_NUMBER', renderTrigger: true } }],
      ],
    },
  ],
};

export default config;
