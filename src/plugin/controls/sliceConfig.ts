import { columnNameOf, metricLabelOf, normalizeKey } from '../../utils/rows';

const t = (s: string) => s;

/** Chiavi distinte delle fette, nell'ordine di comparsa, dalle righe di una query. */
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
 * Colonne mostrate dal controllo per fetta. In modalita' metriche sono le metriche;
 * in modalita' colonna sono i valori della dimensione nelle query gia' eseguite.
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
  ['inherit', t('Eredita')],
  ['higher_is_better', t('Meglio se maggiore')],
  ['lower_is_better', t('Meglio se minore')],
  ['neutral', t('Neutro')],
];

const VALUE_MODE_OPTIONS = [
  ['inherit', t('Eredita')],
  ['value', t('Valore')],
  ['percent', t('Percentuale')],
  ['value_percent', t('Valore e percentuale')],
];

/** Colori dal tema di Superset o scelti da una tavolozza: nessun codice esadecimale da scrivere. */
export const COLOR_CHOICES = [
  ['', t('Automatico')],
  ['#1f77b4', t('Blu')],
  ['#ff7f0e', t('Arancio')],
  ['#2ca02c', t('Verde')],
  ['#d62728', t('Rosso')],
  ['#9467bd', t('Viola')],
  ['#8c564b', t('Marrone')],
  ['#e377c2', t('Rosa')],
  ['#17becf', t('Ciano')],
  ['#bcbd22', t('Oliva')],
  ['#7f7f7f', t('Grigio')],
];

/**
 * Controllo per fetta. Il layout e' a schede: generale (nome, visibilita', colore, polarita')
 * e formato (valore, decimali). Il valore salvato e' un oggetto per chiave di fetta.
 */
export const sliceConfigControl = {
  type: 'ColumnConfigControl',
  label: t('Fette: nome, colore, formato, polarita\''),
  description: t('Personalizza ogni fetta. Le modifiche valgono per la chiave della fetta, quindi restano anche se cambia l\'ordine.'),
  default: {},
  renderTrigger: true,
  width: 440,
  height: 380,
  shouldMapStateToProps: () => true,
  mapStateToProps: sliceColumnsMapper,
  // Layout per tipo di colonna: 0 = Numeric (GenericDataType).
  configFormLayout: {
    0: [
      {
        tab: t('Generale'),
        children: [
          ['customColumnName', 'visible'],
          [
            {
              name: 'dc_color',
              config: { type: 'Select', label: t('Colore'), default: '', clearable: true, choices: COLOR_CHOICES },
            },
          ],
          [
            {
              name: 'dc_polarity',
              config: { type: 'RadioButtonControl', label: t('Significato della variazione'), default: 'inherit', options: POLARITY_OPTIONS },
            },
          ],
        ],
      },
      {
        tab: t('Formato'),
        children: [
          [
            {
              name: 'dc_value_mode',
              config: { type: 'RadioButtonControl', label: t('Mostra'), default: 'inherit', options: VALUE_MODE_OPTIONS },
            },
          ],
          ['d3NumberFormat', 'currencyFormat'],
        ],
      },
    ],
  },
};
