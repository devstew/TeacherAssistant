import { describe, expect, it } from 'vitest';
import { ATTENTION, BEHAVIOR, LEARNING, toggleCheck } from './formSchema';
import { categoryIndex, concentrationIndex, independenceIndex, scoreLesson } from './scoring';
import { DEFAULT_SETTINGS, type LessonObservation, type Settings } from './types';

const S = DEFAULT_SETTINGS;
const set = (...ids: string[]) => new Set(ids);

describe('categoryIndex', () => {
  it('повертає null, якщо не позначено жодного оцінного пункту', () => {
    expect(categoryIndex(LEARNING, set(), S)).toBeNull();
    // «Працює з допомогою асистента» — нейтральний пункт
    expect(categoryIndex(LEARNING, set('learn.with_assistant'), S)).toBeNull();
  });

  it('рахує 50 + 50 × (P/Pmax − N/Nmax)', () => {
    // Навчальна діяльність: 5 позитивних, 4 негативні пункти
    expect(categoryIndex(LEARNING, set('learn.active', 'learn.interest'), S)).toBeCloseTo(50 + 50 * (2 / 5));
    expect(categoryIndex(LEARNING, set('learn.active', 'learn.hard_focus'), S)).toBeCloseTo(50 + 50 * (1 / 5 - 1 / 4));
    // Поведінка: «Адекватна» — єдиний позитивний пункт
    expect(categoryIndex(BEHAVIOR, set('beh.adequate'), S)).toBe(100);
    expect(categoryIndex(BEHAVIOR, set('beh.adequate', 'beh.tires'), S)).toBeCloseTo(50 + 50 * (1 - 1 / 6));
    expect(categoryIndex(BEHAVIOR, set('beh.impulsive', 'beh.distracted', 'beh.stubborn'), S)).toBeCloseTo(25);
  });

  it('враховує змінені полярність і вагу', () => {
    const s: Settings = { ...S, itemOverrides: { 'learn.with_assistant': { polarity: -1 }, 'learn.active': { weight: 3 } } };
    // P = 3 з Pmax = 7, N = 1 з Nmax = 5
    expect(categoryIndex(LEARNING, set('learn.active', 'learn.with_assistant'), s)).toBeCloseTo(50 + 50 * (3 / 7 - 1 / 5));
  });

  it('увага: стійка й довільна = 100, не стійка й мимовільна = 0', () => {
    expect(categoryIndex(ATTENTION, set('att.stable', 'att.voluntary'), S)).toBe(100);
    expect(categoryIndex(ATTENTION, set('att.unstable', 'att.involuntary'), S)).toBe(0);
  });
});

describe('toggleCheck', () => {
  it('знімає протилежний пункт із групи взаємовиключення', () => {
    expect(toggleCheck(['att.stable', 'att.voluntary'], 'att.unstable').sort()).toEqual(['att.unstable', 'att.voluntary']);
    expect(toggleCheck(['att.stable'], 'att.stable')).toEqual([]);
    expect(toggleCheck(['beh.tires'], 'beh.impulsive').sort()).toEqual(['beh.impulsive', 'beh.tires']);
  });
});

describe('independenceIndex', () => {
  it('без рівня допомоги — null', () => {
    expect(independenceIndex({ checks: ['ast.visuals'] }, S)).toBeNull();
  });

  it('допомога не потрібна й без адаптацій — 100; в усьому з усіма адаптаціями — 0', () => {
    expect(independenceIndex({ helpLevel: 'none', checks: [] }, S)).toBe(100);
    const all = ['ast.org_help', 'ast.visuals', 'ast.leading_questions', 'ast.more_time', 'ast.duplication', 'ast.explanations', 'ast.activation', 'ast.encouragement'];
    expect(independenceIndex({ helpLevel: 'full', checks: all }, S)).toBeCloseTo(0);
  });

  it('частково + 2 адаптації з 8', () => {
    const v = independenceIndex({ helpLevel: 'partial', checks: ['ast.visuals', 'ast.more_time'] }, S);
    expect(v).toBeCloseTo(100 * (1 - (0.7 * (2 / 3) + 0.3 * (2 / 8))));
  });
});

describe('scoreLesson', () => {
  it('концентрація — частка уроку й зведені індекси', () => {
    const obs: LessonObservation = {
      id: 'x', studentId: 's', date: '2026-09-01', lessonNumber: 1, updatedAt: '',
      checks: ['learn.active', 'att.stable', 'att.voluntary', 'beh.adequate', 'emo.positive'],
      helpLevel: 'none',
      attentionMinutes: 20,
    };
    const s = scoreLesson(obs, S, 40);
    expect(s.concentration).toBe(50);
    expect(s.attention).toBe(100);
    expect(s.teacher).toBeNull();
    // навчання = середнє з learning (60), attention (100), independence (100); teacher = null
    expect(s.learningComposite).toBeCloseTo((60 + 100 + 100) / 3);
    expect(s.behaviorComposite).toBeCloseTo((100 + 75) / 2);
    expect(concentrationIndex({ attentionMinutes: 60 }, 45)).toBe(100);
  });
});
