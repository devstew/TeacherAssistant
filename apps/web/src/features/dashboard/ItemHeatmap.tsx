import { CATEGORIES, type CategoryId } from '@journal/core';
import { resolveItem } from '@journal/core';
import { MONTHS_SHORT, monthIndex } from '@journal/core';
import type { Bucket, Grouping } from '@journal/core';
import type { Settings } from '@journal/core';
import { fmtDelta } from '@journal/core';
import { heatBin } from './vizTheme';

const SIGN = { 1: '+', [-1]: '−', 0: '·' } as const;

/**
 * Теплова карта «пункти бланку × періоди»: колір — частота (% уроків, де пункт
 * позначено серед уроків із заповненою категорією). Це водночас і таблиця значень.
 */
export function ItemHeatmap({
  buckets,
  grouping,
  settings,
  current,
  previous,
  categories,
}: {
  buckets: Bucket[];
  grouping: Grouping;
  settings: Settings;
  current?: Bucket;
  previous?: Bucket;
  categories: CategoryId[];
}) {
  const shown = buckets.filter((b) => b.observed > 0 || b.observedDays > 0);
  const years = new Set(shown.map((b) => b.key.slice(0, 4)));
  const colLabel = (b: Bucket) =>
    grouping === 'month' ? `${MONTHS_SHORT[monthIndex(b.key)]}${years.size > 1 ? ` ${b.key.slice(2, 4)}` : ''}` : b.label;
  const showDelta = !!(current && previous);

  return (
    <div className="viz overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white text-left font-medium text-slate-500 dark:bg-slate-900">Пункт бланку</th>
            {shown.map((b) => (
              <th key={b.key} className="min-w-12 px-1 text-center font-medium whitespace-nowrap text-slate-500">
                {colLabel(b)}
              </th>
            ))}
            {showDelta && <th className="min-w-14 px-1 text-center font-medium text-slate-500">Зміна</th>}
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.filter((cat) => categories.includes(cat.id)).map((cat) => (
            <CategoryRows key={cat.id} catId={cat.id} shown={shown} settings={settings} current={current} previous={previous} showDelta={showDelta} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryRows({
  catId,
  shown,
  settings,
  current,
  previous,
  showDelta,
}: {
  catId: CategoryId;
  shown: Bucket[];
  settings: Settings;
  current?: Bucket;
  previous?: Bucket;
  showDelta: boolean;
}) {
  const cat = CATEGORIES.find((c) => c.id === catId)!;
  const unit = cat.scope === 'day' ? 'днів' : 'уроків';
  return (
    <>
      <tr>
        <th colSpan={shown.length + 2} className="sticky left-0 bg-white pt-3 pb-1 text-left text-[13px] font-semibold dark:bg-slate-900">
          {cat.title}
        </th>
      </tr>
      {cat.items.map((item) => {
        const pol = resolveItem(item, settings).polarity;
        const c = current?.itemFreq[item.id];
        const p = previous?.itemFreq[item.id];
        const d = c?.pct != null && p?.pct != null ? c.pct - p.pct : null;
        // Для негативних пунктів зменшення частоти — покращення.
        const good = d != null && pol !== 0 && Math.abs(d) >= 5 ? pol * d > 0 : null;
        return (
          <tr key={item.id}>
            <td className="sticky left-0 z-10 max-w-64 bg-white py-0.5 pr-2 dark:bg-slate-900">
              <span className="mr-1 inline-block w-3 text-center text-slate-400" title={pol === 1 ? 'позитивний пункт' : pol === -1 ? 'негативний пункт' : 'нейтральний пункт'}>
                {SIGN[pol]}
              </span>
              {item.label}
            </td>
            {shown.map((b) => {
              const f = b.itemFreq[item.id];
              if (!f || f.pct == null) {
                return (
                  <td key={b.key} className="text-center text-slate-300 dark:text-slate-600">
                    —
                  </td>
                );
              }
              const bin = heatBin(f.pct);
              return (
                <td
                  key={b.key}
                  title={`${item.label}: ${Math.round(f.pct)}% ${unit} (${f.count} з ${f.n}) · ${b.label}`}
                  className="rounded px-1 py-1 text-center tabular-nums"
                  style={{ background: `var(--heat-${bin})`, color: `var(--heat-ink-${bin})` }}
                >
                  {Math.round(f.pct)}
                </td>
              );
            })}
            {showDelta && (
              <td
                className="px-1 text-center font-medium whitespace-nowrap tabular-nums"
                style={{ color: good == null ? 'var(--viz-muted)' : good ? 'var(--viz-good)' : 'var(--viz-bad)' }}
                title={good == null ? undefined : good ? 'покращення' : 'погіршення'}
              >
                {d == null ? '—' : `${Math.round(d) > 0 ? '▲ ' : Math.round(d) < 0 ? '▼ ' : ''}${fmtDelta(d)}`}
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}
