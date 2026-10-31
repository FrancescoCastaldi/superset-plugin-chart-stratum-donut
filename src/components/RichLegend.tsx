import { SliceModel } from '../utils/model';
import { LegendColumn } from '../utils/style';
import { formatDeltaPct, formatNumber, formatPercent, formatPts, trendArrow } from '../utils/format';
import { ArrowStyle } from '../utils/format';

interface Props {
  slices: SliceModel[];
  columns: LegendColumn[];
  comparison: boolean;
  arrows: ArrowStyle;
  deltaDecimals: number;
  hovered: string | null;
  onHover: (key: string | null) => void;
  onToggle: (key: string) => void;
  hiddenKeys: Set<string>;
}

/** HTML legend: color, name, value, share and change per slice. Interactive. */
export default function RichLegend(props: Props) {
  const { slices, columns, comparison, arrows, deltaDecimals, hovered, onHover, onToggle, hiddenKeys } = props;
  const has = (c: LegendColumn) => columns.includes(c);
  return (
    <ul className="dc-legend" aria-label="Legend">
      {slices.map(s => {
        const off = hiddenKeys.has(s.key);
        return (
          <li
            key={s.key}
            onMouseEnter={() => onHover(s.key)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onToggle(s.key)}
            style={{
              display: 'grid',
              gridTemplateColumns: '12px 1fr',
              gap: 6,
              alignItems: 'start',
              padding: '3px 4px',
              opacity: off || (hovered !== null && hovered !== s.key) ? 0.4 : 1,
              cursor: 'pointer',
              listStyle: 'none',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block' }} />
            <span>
              <span style={{ display: 'block' }}>
                {s.label}
                {s.isNew ? <em style={{ marginLeft: 4, opacity: 0.7 }}>New</em> : null}
                {s.isGone ? <em style={{ marginLeft: 4, opacity: 0.7 }}>Missing</em> : null}
                {s.unknown !== 'none' ? <em style={{ marginLeft: 4, opacity: 0.7 }}>n/a</em> : null}
              </span>
              <span style={{ display: 'block', opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>
                {has('value') ? formatNumber(s.refValue, 0) : null}
                {has('share') ? ` · ${formatPercent(s.refShare, 1)}` : null}
                {comparison && has('delta') && s.deltaPts !== null ? (
                  <span title={`Change %: ${formatDeltaPct(s.deltaPct, deltaDecimals)}`} style={{ marginLeft: 6 }}>
                    {trendArrow(s.trendShare, arrows)} {formatPts(s.deltaPts, deltaDecimals)}
                  </span>
                ) : null}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
