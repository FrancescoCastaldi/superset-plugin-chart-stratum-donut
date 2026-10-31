/** Direzione del delta. 'none' = base zero (fetta nuova), si mostra "Nuovo". */
export type TrendDirection = 'up' | 'down' | 'flat' | 'none';

/** Da cosa nascono le fette: valori di una colonna oppure una fetta per metrica. */
export type SliceMode = 'column' | 'metrics';

/** Cosa mostrare per una fetta. */
export type ValueDisplay = 'value' | 'percent' | 'value_percent';

/** Significato del delta: per "lower_is_better" una diminuzione e' positiva. */
export type Polarity = 'higher_is_better' | 'lower_is_better' | 'neutral';

/** Ordinamento delle fette (sempre sul periodo di riferimento, "Altro" in fondo). */
export type SliceSort = 'value_desc' | 'value_asc' | 'label' | 'data';

/** Delta mostrato per fetta: punti di quota, variazione % del valore o entrambi. */
export type DeltaMode = 'points' | 'percent' | 'both' | 'none';

/** Intervallo semi-aperto [start, end), in UTC. */
export interface PeriodRange {
  start: Date;
  end: Date;
}

export type Granularity = 'all' | 'open_start' | 'open_end' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface PeriodInfo {
  /** Stringa originale ricevuta (es. "2026-10-01 : 2026-11-01" o "Last month"). */
  raw: string | null;
  /** Intervallo esplicito, se la stringa e' interpretabile. */
  range: PeriodRange | null;
  granularity: Granularity | null;
  /** Etichetta leggibile, es. "Ott 2026", "2026", "01/10/2026 - 15/10/2026". */
  label: string;
}

/** Riga normalizzata: una fetta con i due periodi gia' uniti. */
export interface SliceDatum {
  key: string;
  label: string;
  refValue: number;
  cmpValue: number | null;
  /** Quote in [0, 1] sul totale del rispettivo periodo. */
  refShare: number;
  cmpShare: number | null;
  deltaAbs: number | null;
  /** Variazione % del valore (riferimento vs confronto), null se base zero. */
  deltaPct: number | null;
  /** Variazione della quota in punti percentuali. */
  deltaPts: number | null;
  /** Direzione della variazione del valore. */
  trend: TrendDirection;
  /** Direzione della variazione della quota (punti). */
  trendShare: TrendDirection;
  /** Presente nel riferimento ma assente nel confronto. */
  isNew: boolean;
  /** Presente solo nel confronto. */
  isGone: boolean;
  isOther: boolean;
  /** 'ref' o 'cmp' se quel periodo ha raggiunto il limite di righe: il valore non e' noto. */
  unknown: 'none' | 'ref' | 'cmp';
  /** Valore originale della dimensione (per il cross-filter), assente per Altro e Altri. */
  raw?: unknown;
  /** Chiavi raggruppate in "Altro". */
  members?: string[];
}

export interface MergeResult {
  slices: SliceDatum[];
  refTotal: number;
  cmpTotal: number | null;
  hasComparison: boolean;
  /** Valori negativi trovati: in un donut non hanno senso, vengono trattati come 0. */
  negativeKeys: string[];
}
