import { ControlPanelConfig, sharedControls } from '@superset-ui/chart-controls';
import { sliceConfigControl } from './controls/sliceConfig';

const t = (str: string) => str;

const modeIs = (mode: 'column' | 'metrics') => ({ controls }: any) => controls?.dc_mode?.value === mode;
const compareSourceIs = (...sources: string[]) => ({ controls }: any) => sources.includes(controls?.dc_compare_source?.value);
const presetIs = (preset: string) => ({ controls }: any) => controls?.dc_compare_preset?.value === preset;
const otherModeIs = (mode: string) => ({ controls }: any) => controls?.dc_other_mode?.value === mode;

/** Colonne temporali del dataset, per scegliere quella del periodo. */
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
      label: t('Dati'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'dc_mode',
            config: {
              type: 'RadioButtonControl',
              label: t('Fette da'),
              default: 'column',
              options: [
                ['column', t('Colonna (ogni valore e\' una fetta)')],
                ['metrics', t('Metriche (ogni metrica e\' una fetta)')],
              ],
            },
          },
        ],
        [{ name: 'metric', config: { ...sharedControls.metric, label: t('Metrica'), validators: [], visibility: modeIs('column') } }],
        [
          {
            name: 'groupby',
            config: { ...sharedControls.groupby, label: t('Dimensione (fette)'), multi: false, validators: [], visibility: modeIs('column') },
          },
        ],
        [{ name: 'metrics', config: { ...sharedControls.metrics, label: t('Metriche (fette)'), validators: [], visibility: modeIs('metrics') } }],
        [
          {
            name: 'dc_total_metric',
            config: {
              type: 'SelectControl',
              label: t('Metrica totale (opzionale)'),
              description: t('Denominatore delle quote. Se assente, il totale e\' la somma delle fette.'),
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
              label: t('Colonna temporale del periodo'),
              description: t('Serve per applicare il periodo di riferimento e di confronto.'),
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
              label: t('Righe massime'),
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
              label: t('Totale esatto (query dedicata)'),
              description: t('Usa il totale reale anche quando il limite di righe nasconde alcune fette.'),
              default: false,
              visibility: modeIs('column'),
            },
          },
        ],
      ],
    },
    {
      label: t('Confronto periodi'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'dc_compare_source',
            config: {
              type: 'SelectControl',
              label: t('Confronto da'),
              default: 'auto',
              clearable: false,
              choices: [
                ['auto', t('Filtro dashboard, altrimenti il preset')],
                ['dashboard', t('Solo filtro dashboard')],
                ['chart', t('Solo preset del chart')],
                ['none', t('Nessun confronto')],
              ],
            },
          },
        ],
        [
          {
            name: 'dc_compare_preset',
            config: {
              type: 'SelectControl',
              label: t('Periodo di confronto'),
              description: t('Calcolato sul periodo di riferimento. Con un filtro dashboard il suo confronto ha la precedenza.'),
              default: 'previous_period',
              clearable: false,
              choices: [
                ['previous_period', t('Periodo precedente di pari durata')],
                ['previous_week', t('Settimana precedente')],
                ['previous_month', t('Mese precedente')],
                ['previous_quarter', t('Trimestre precedente')],
                ['previous_year', t('Anno precedente')],
                ['same_weekday_last_year', t('Stesso giorno della settimana, un anno fa')],
                ['custom', t('Intervallo personalizzato')],
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
              label: t('Intervallo di confronto'),
              default: 'No filter',
              visibility: ({ controls }: any) => compareSourceIs('auto', 'chart')({ controls }) && presetIs('custom')({ controls }),
            },
          },
        ],
      ],
    },
    {
      label: t('Periodi e anelli'),
      expanded: false,
      controlSetRows: [
        [{ name: 'dc_ref_label', config: { type: 'TextControl', label: t('Etichetta riferimento'), default: '', renderTrigger: true } }],
        [{ name: 'dc_cmp_label', config: { type: 'TextControl', label: t('Etichetta confronto'), default: '', renderTrigger: true } }],
        [
          {
            name: 'dc_period_style',
            config: select('Stile del periodo', [['short', t('Breve: Ott 2026')], ['long', t('Esteso: Ottobre 2026')]], 'short'),
          },
        ],
        [{ name: 'dc_outer_radius', config: slider('Raggio esterno (%)', 40, 100, 1, 85) }],
        [{ name: 'dc_ring_width', config: slider('Spessore anello (%)', 5, 40, 1, 25) }],
        [
          {
            name: 'dc_inner_ring_width',
            config: slider('Spessore anello interno (0 = uguale)', 0, 40, 1, 0),
          },
        ],
        [{ name: 'dc_ring_gap', config: slider('Distanza tra anelli (%)', 0, 15, 1, 3) }],
        [{ name: 'dc_start_angle', config: slider('Angolo di partenza', 0, 360, 1, 90) }],
        [
          {
            name: 'dc_cmp_style',
            config: select('Stile anello confronto', [['faded', t('Attenuato')], ['solid', t('Pieno')]], 'faded'),
          },
        ],
      ],
    },
    {
      label: t('Etichette'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'dc_label_rings',
            config: select('Anelli con etichetta', [['outer', t('Solo esterno')], ['both', t('Entrambi')], ['none', t('Nessuno')]], 'outer'),
          },
        ],
        [
          {
            name: 'dc_label_content',
            config: select(
              'Contenuto',
              [
                ['percent', t('Percentuale')],
                ['value', t('Valore')],
                ['value_percent', t('Valore e percentuale')],
                ['name_percent', t('Nome e percentuale')],
                ['name_value_percent', t('Nome, valore e percentuale')],
                ['percent_delta', t('Percentuale e variazione')],
              ],
              'name_percent',
            ),
          },
        ],
        [
          {
            name: 'dc_label_position',
            config: select('Posizione', [['outside', t('Fuori')], ['inside', t('Dentro')]], 'outside'),
          },
        ],
        [{ name: 'dc_label_min_share', config: slider('Etichetta solo sopra (%)', 0, 10, 0.5, 3) }],
      ],
    },
    {
      label: t('Fette'),
      expanded: false,
      controlSetRows: [[{ name: 'dc_slice_config', config: sliceConfigControl }]],
    },
    {
      label: t('Raggruppamento e ordine'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'dc_other_mode',
            config: select('Fette piccole', [['threshold', t('Sotto una soglia')], ['top_n', t('Solo le prime N')], ['none', t('Nessun raggruppamento')]], 'threshold'),
          },
        ],
        [
          {
            name: 'dc_other_threshold',
            config: slider('Soglia (%)', 0, 20, 0.5, 2, { visibility: otherModeIs('threshold') }),
          },
        ],
        [
          {
            name: 'dc_other_top_n',
            config: slider('Fette da tenere (N)', 2, 30, 1, 8, { visibility: otherModeIs('top_n') }),
          },
        ],
        [{ name: 'dc_other_label', config: { type: 'TextControl', label: t('Nome del gruppo'), default: 'Altro', renderTrigger: true } }],
        [
          {
            name: 'dc_sort',
            config: select(
              'Ordine delle fette',
              [['auto', t('Automatico')], ['ref_desc', t('Valore decrescente')], ['ref_asc', t('Valore crescente')], ['name_asc', t('Nome')]],
              'auto',
            ),
          },
        ],
        [{ name: 'dc_hide_zero_slices', config: checkbox('Nascondi fette a zero', true) }],
      ],
    },
    {
      label: t('Legenda e centro'),
      expanded: false,
      controlSetRows: [
        [{ name: 'dc_legend_show', config: checkbox('Mostra legenda', true) }],
        [
          {
            name: 'dc_legend_position',
            config: select('Posizione legenda', [['right', t('A destra')], ['bottom', t('In basso')]], 'right'),
          },
        ],
        [
          {
            name: 'dc_legend_columns',
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('Colonne della legenda'),
              default: ['value', 'share', 'delta'],
              choices: [['value', t('Valore')], ['share', t('Quota')], ['delta', t('Variazione')]],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'dc_center_content',
            config: select(
              'Testo al centro',
              [['ref_total_delta', t('Totale e variazione')], ['ref_total', t('Solo totale')], ['none', t('Nessuno')]],
              'ref_total_delta',
            ),
          },
        ],
        [{ name: 'dc_center_caption', config: { type: 'TextControl', label: t('Titolo del centro'), default: 'Totale', renderTrigger: true } }],
      ],
    },
    {
      label: t('Tooltip, delta e formati'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'dc_tooltip_items',
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('Voci del tooltip'),
              default: ['values', 'shares', 'delta_pct', 'delta_pts'],
              choices: [
                ['values', t('Valori dei due periodi')],
                ['shares', t('Quote')],
                ['delta_abs', t('Differenza assoluta')],
                ['delta_pct', t('Variazione %')],
                ['delta_pts', t('Variazione quota in punti')],
              ],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'dc_default_polarity',
            config: select(
              'Significato predefinito della variazione',
              [['higher_is_better', t('Meglio se maggiore')], ['lower_is_better', t('Meglio se minore')], ['neutral', t('Neutro')]],
              'higher_is_better',
            ),
          },
        ],
        [
          {
            name: 'dc_delta_arrows',
            config: select('Frecce', [['triangle', '▲ ▼'], ['arrow', '↑ ↓'], ['none', t('Nessuna')]], 'triangle'),
          },
        ],
        [{ name: 'dc_delta_decimals', config: slider('Decimali delle variazioni', 0, 3, 1, 1) }],
        [{ name: 'color_scheme', config: { ...sharedControls.color_scheme, renderTrigger: true } }],
        [{ name: 'number_format', config: { ...sharedControls.y_axis_format, label: t('Formato dei valori'), default: 'SMART_NUMBER', renderTrigger: true } }],
      ],
    },
  ],
};

export default config;
