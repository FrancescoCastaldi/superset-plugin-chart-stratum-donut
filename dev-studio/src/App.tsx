import { useEffect, useMemo, useState } from 'react';
import StratumDonutChart from '../../src/components/StratumDonutChart';
import transformProps from '../../src/plugin/transformProps';
import { SCENARIOS } from './scenarios';

/** Development sandbox: runs the real transformProps and shows the chart. */
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const initial = SCENARIOS.find(s => s.id === params.get('scenario'))?.id ?? SCENARIOS[0].id;
  // Embed mode (?embed=1&width=&height=): only the chart, used to export README and gallery images.
  const embed = params.get('embed') === '1';
  const height = Number(params.get('height')) || 380;
  const [id, setId] = useState(initial);
  const [width, setWidth] = useState<number | null>(Number(params.get('width')) || null);
  // Simulated selection: replaces Superset's filterState for the cross-filter.
  const [selected, setSelected] = useState<string[]>([]);
  const scenario = SCENARIOS.find(s => s.id === id)!;
  const stageWidth = width ?? scenario.width ?? 640;

  useEffect(() => {
    setSelected([]);
  }, [id]);

  useEffect(() => {
    document.body.classList.toggle('dark', Boolean(scenario.dark));
    const url = new URL(window.location.href);
    url.searchParams.set('scenario', id);
    window.history.replaceState({}, '', url);
  }, [id, scenario.dark]);

  const props = useMemo(() => {
    const chartProps = {
      width: stageWidth,
      height,
      rawFormData: scenario.formData,
      queriesData: scenario.queries,
      filterState: { selectedValues: selected },
      emitCrossFilters: true,
      setDataMask: (mask: any) => setSelected(mask.filterState.selectedValues),
      onContextMenu: (x: number, y: number, payload: any) => console.log('contextmenu', x, y, payload),
      theme: scenario.dark ? { colorText: '#e6e8eb', colorBgContainer: '#1d2127' } : { colorText: '#1f2933', colorBgContainer: '#ffffff' },
    };
    return transformProps(chartProps as any);
  }, [scenario, stageWidth, height, selected]);

  if (embed) {
    return (
      <div className="stage" style={{ width: stageWidth, border: 'none', margin: 0 }}>
        <StratumDonutChart {...props} width={stageWidth} height={height} />
      </div>
    );
  }

  return (
    <div>
      <div className="bar">
        <label>
          Scenario{' '}
          <select value={id} onChange={e => setId(e.target.value)}>
            {SCENARIOS.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Width{' '}
          <select value={stageWidth} onChange={e => setWidth(Number(e.target.value))}>
            {[360, 480, 640, 900].map(w => (
              <option key={w} value={w}>
                {w} px
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setSelected([])}>Clear selection</button>
        <span>Selected: {selected.length ? selected.join(', ') : 'none'}</span>
        <span>Reference total: {props.model.refTotal.toLocaleString('en-US')}</span>
      </div>

      <div className="stage" style={{ width: stageWidth + 2 }}>
        <StratumDonutChart {...props} width={stageWidth} height={height} />
      </div>

      <table>
        <thead>
          <tr>
            <th>Slice</th>
            <th>Reference</th>
            <th>Comparison</th>
            <th>Ref. share</th>
            <th>Δ share (pt)</th>
            <th>Δ %</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {props.model.slices.map(s => (
            <tr key={s.key}>
              <td>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: s.color, marginRight: 6 }} />
                {s.label}
              </td>
              <td>{s.refValue.toLocaleString('en-US')}</td>
              <td>{s.cmpValue === null ? '-' : s.cmpValue.toLocaleString('en-US')}</td>
              <td>{(s.refShare * 100).toFixed(1)}%</td>
              <td>{s.deltaPts === null ? '-' : s.deltaPts.toFixed(1)}</td>
              <td>{s.deltaPct === null ? '-' : s.deltaPct.toFixed(1)}</td>
              <td>
                {s.isNew ? 'new' : s.isGone ? 'missing' : s.unknown !== 'none' ? 'unknown' : s.isOther ? 'other' : ''}
                {s.sentiment !== 'neutral' ? ` · ${s.sentiment}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {props.notices.length > 0 ? (
        <ul>
          {props.notices.map((n, i) => (
            <li key={i}>
              [{n.level}] {n.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
