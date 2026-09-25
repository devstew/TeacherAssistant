/**
 * Текстові висновки за шаблонами (без ШІ). Висновок про зміну показується лише
 * тоді, коли в обох порівнюваних періодах достатньо заповнених уроків і зміна
 * перевищує поріг — щоб не робити висновків із випадкових коливань.
 */
import { ALL_ITEMS, CATEGORY_OF_ITEM, ITEM_BY_ID } from './formSchema';
import { resolveItem } from './scoring';
import {
  CATEGORY_METRICS,
  METRIC_LABELS,
  delta,
  type Bucket,
  type Grouping,
  type MetricId,
  type Stats,
} from './aggregate';
import { MONTHS_INS, MONTHS_LOC, MONTHS_NOM, monthIndex, weekLabel } from './dates';
import type { Settings } from './types';

export interface Insight {
  tone: 'good' | 'bad' | 'neutral' | 'info';
  text: string;
}

export interface InsightInput {
  buckets: Bucket[];
  grouping: Grouping;
  /** Статистика за весь вибраний період. */
  overall: Stats;
  bySubject: { key: string; stats: Stats }[];
  byLessonNumber: { key: string; stats: Stats }[];
  settings: Settings;
}

const MINUS = '−';
export const fmtNum = (v: number) => String(Math.round(v));
export const fmtDelta = (d: number) => {
  const r = Math.round(d);
  return r > 0 ? `+${r}` : r < 0 ? `${MINUS}${Math.abs(r)}` : '0';
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Phrases {
  /** «у листопаді» / «за тиждень 3–9 лис» */
  loc: string;
  /** «з листопадом» / «з тижнем 3–9 лис» */
  ins: string;
  /** «листопад» / «тиждень 3–9 лис» */
  nom: string;
}

function phrases(b: Bucket, grouping: Grouping): Phrases {
  if (grouping === 'month') {
    const i = monthIndex(b.key);
    return { loc: MONTHS_LOC[i], ins: MONTHS_INS[i], nom: MONTHS_NOM[i] };
  }
  const w = weekLabel(b.start);
  return { loc: `за тиждень ${w}`, ins: `з тижнем ${w}`, nom: `тиждень ${w}` };
}

const unitFor = (itemId: string) => (CATEGORY_OF_ITEM[itemId] === 'social' ? 'днів' : 'уроків');

export function buildInsights(input: InsightInput): Insight[] {
  const { buckets, grouping, settings } = input;
  const { minLessons, minDelta, minItemDelta } = settings.insights;
  const out: Insight[] = [];

  const qualifying = buckets.filter((b) => b.observed >= minLessons);
  const cur = qualifying.at(-1);
  const prev = qualifying.at(-2);

  if (!cur || !prev) {
    out.push({
      tone: 'info',
      text: `Замало даних для порівняння періодів: потрібно щонайменше ${minLessons} заповнених уроків у кожному з двох періодів.`,
    });
  } else {
    const pc = phrases(cur, grouping);
    const pp = phrases(prev, grouping);
    const L = cur.metrics.learningIndex.value;
    const B = cur.metrics.behaviorIndex.value;
    const dL = delta(L, prev.metrics.learningIndex.value);
    const dB = delta(B, prev.metrics.behaviorIndex.value);
    const bigL = dL != null && Math.abs(dL) >= minDelta;
    const bigB = dB != null && Math.abs(dB) >= minDelta;

    // 1. Головний висновок про навчання й поведінку.
    if (bigL && bigB && Math.sign(dL!) === Math.sign(dB!)) {
      const better = dL! > 0;
      out.push({
        tone: better ? 'good' : 'bad',
        text:
          `${cap(pc.loc)} дитина показала ${better ? 'кращі' : 'нижчі'} показники, ніж ${pp.loc}: ` +
          `навчання ${fmtNum(L!)} (${fmtDelta(dL!)} п.п.), поведінка ${fmtNum(B!)} (${fmtDelta(dB!)} п.п.).`,
      });
    } else if (bigL || bigB) {
      for (const [name, v, d, big] of [
        ['навчання', L, dL, bigL],
        ['поведінки', B, dB, bigB],
      ] as const) {
        if (!big) continue;
        out.push({
          tone: d! > 0 ? 'good' : 'bad',
          text: `${cap(pc.loc)} індекс ${name} ${fmtNum(v!)} (${fmtDelta(d!)} п.п. порівняно ${pp.ins}, ${cur.observed} уроків).`,
        });
      }
    } else if (L != null && B != null) {
      out.push({
        tone: 'neutral',
        text: `${cap(pc.loc)} показники стабільні: навчання ${fmtNum(L)}, поведінка ${fmtNum(B)} (зміни менші за ${minDelta} п.п. порівняно ${pp.ins}).`,
      });
    }

    // 2. Категорії з найбільшою зміною.
    const catDeltas = CATEGORY_METRICS.map((m) => ({
      m,
      d: delta(cur.metrics[m].value, prev.metrics[m].value),
      v: cur.metrics[m].value,
    })).filter((x): x is { m: MetricId; d: number; v: number } => x.d != null && x.v != null);
    const up = catDeltas.filter((x) => x.d >= minDelta).sort((a, b) => b.d - a.d)[0];
    const down = catDeltas.filter((x) => x.d <= -minDelta).sort((a, b) => a.d - b.d)[0];
    if (up) {
      out.push({
        tone: 'good',
        text: `Найбільше зріс показник «${METRIC_LABELS[up.m]}»: ${fmtNum(up.v)} (${fmtDelta(up.d)} п.п.).`,
      });
    }
    if (down) {
      out.push({
        tone: 'bad',
        text: `Найбільше знизився показник «${METRIC_LABELS[down.m]}»: ${fmtNum(down.v)} (${fmtDelta(down.d)} п.п.).`,
      });
    }

    // 3. Окремі пункти бланку: покращення й погіршення частоти.
    const itemChanges = ALL_ITEMS.flatMap((item) => {
      const pol = resolveItem(item, settings).polarity;
      const c = cur.itemFreq[item.id];
      const p = prev.itemFreq[item.id];
      if (pol === 0 || !c || !p || c.pct == null || p.pct == null || c.n < 5 || p.n < 5) return [];
      const d = c.pct - p.pct;
      if (Math.abs(d) < minItemDelta) return [];
      return [{ id: item.id, cur: c.pct, prev: p.pct, gain: pol * d }];
    });
    const improvements = itemChanges.filter((x) => x.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 2);
    const declines = itemChanges.filter((x) => x.gain < 0).sort((a, b) => a.gain - b.gain).slice(0, 2);
    for (const x of improvements) {
      out.push({
        tone: 'good',
        text: `Покращення: «${ITEM_BY_ID[x.id].label}» — ${fmtNum(x.cur)}% ${unitFor(x.id)} (було ${fmtNum(x.prev)}%).`,
      });
    }
    for (const x of declines) {
      out.push({
        tone: 'bad',
        text: `Потребує уваги: «${ITEM_BY_ID[x.id].label}» — ${fmtNum(x.cur)}% ${unitFor(x.id)} (було ${fmtNum(x.prev)}%).`,
      });
    }

    // 4. Потреба в повній допомозі асистента.
    if (cur.help.n >= 5 && prev.help.n >= 5) {
      const cf = (100 * cur.help.full) / cur.help.n;
      const pf = (100 * prev.help.full) / prev.help.n;
      if (pf - cf >= minItemDelta) {
        out.push({
          tone: 'good',
          text: `Допомога асистента «в усьому» потрібна на ${fmtNum(cf)}% уроків (було ${fmtNum(pf)}%) — самостійність зростає.`,
        });
      } else if (cf - pf >= minItemDelta) {
        out.push({
          tone: 'bad',
          text: `Допомога асистента «в усьому» потрібна частіше: ${fmtNum(cf)}% уроків (було ${fmtNum(pf)}%).`,
        });
      }
    }

    // 5. Повнота заповнення останнього періоду.
    if (cur.attended >= 5 && cur.observed / cur.attended < 0.5) {
      out.push({
        tone: 'info',
        text: `${cap(pc.loc)} заповнено лише ${fmtNum((100 * cur.observed) / cur.attended)}% відвіданих уроків — висновки можуть бути неточними.`,
      });
    }
  }

  // 6. Втома протягом дня: перші уроки проти останніх (за весь період).
  const byNum = input.byLessonNumber
    .map((g) => ({ n: Number(g.key), stats: g.stats }))
    .filter((g) => g.stats.observed > 0)
    .sort((a, b) => a.n - b.n);
  if (byNum.length >= 4) {
    const early = byNum.slice(0, 2);
    const late = byNum.slice(-2);
    const range = (gs: typeof byNum) => `${gs[0].n}–${gs[gs.length - 1].n}`;
    for (const id of ['beh.tires', 'beh.distracted', 'att.unstable']) {
      const agg = (gs: typeof byNum) => {
        const count = gs.reduce((s, g) => s + (g.stats.itemFreq[id]?.count ?? 0), 0);
        const n = gs.reduce((s, g) => s + (g.stats.itemFreq[id]?.n ?? 0), 0);
        return { n, pct: n ? (100 * count) / n : 0 };
      };
      const e = agg(early);
      const l = agg(late);
      if (e.n >= 5 && l.n >= 5 && l.pct - e.pct >= 20) {
        out.push({
          tone: 'info',
          text: `«${ITEM_BY_ID[id].label}» частіше на ${range(late)} уроках (${fmtNum(l.pct)}%), ніж на ${range(early)} (${fmtNum(e.pct)}%).`,
        });
        break;
      }
    }
  }

  // 7. Предмети з найвищим і найнижчим індексом навчання.
  const subjects = input.bySubject
    .filter((g) => g.stats.observed >= 5 && g.stats.metrics.learningIndex.value != null)
    .sort((a, b) => b.stats.metrics.learningIndex.value! - a.stats.metrics.learningIndex.value!);
  if (subjects.length >= 2) {
    const best = subjects[0];
    const worst = subjects[subjects.length - 1];
    const bv = best.stats.metrics.learningIndex.value!;
    const wv = worst.stats.metrics.learningIndex.value!;
    if (bv - wv >= 10) {
      out.push({
        tone: 'neutral',
        text: `Найвищий індекс навчання — «${best.key}» (${fmtNum(bv)}), найнижчий — «${worst.key}» (${fmtNum(wv)}).`,
      });
    }
  }

  // 8. Найкращий місяць (тиждень) за кожним зведеним індексом.
  if (qualifying.length >= 3) {
    for (const [metric, name] of [
      ['behaviorIndex', 'поведінки'],
      ['learningIndex', 'навчання'],
    ] as const) {
      const best = [...qualifying]
        .filter((b) => b.metrics[metric].value != null)
        .sort((a, b) => b.metrics[metric].value! - a.metrics[metric].value!)[0];
      if (best) {
        out.push({
          tone: 'neutral',
          text: `Найкращий ${grouping === 'month' ? 'місяць' : 'тиждень'} за індексом ${name} — ${phrases(best, grouping).nom} (${fmtNum(best.metrics[metric].value!)}).`,
        });
      }
    }
  }

  return out;
}
