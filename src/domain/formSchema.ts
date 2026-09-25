/**
 * Схема бланку «Журнал спостережень асистента вчителя».
 *
 * Єдине джерело правди: з неї будуються форма в застосунку, PDF/DOCX-експорт
 * і розрахунок метрик. Id пунктів стабільні — у базі зберігаються лише вони,
 * тож підписи можна змінювати без міграцій.
 */

export type Polarity = 1 | -1 | 0;
export type Scope = 'lesson' | 'day';
export type CategoryId =
  | 'learning'
  | 'attention'
  | 'emotion'
  | 'behavior'
  | 'teacher'
  | 'assistant'
  | 'social';

export interface ItemDef {
  id: string;
  label: string;
  /** +1 — позитивний прояв, −1 — негативний, 0 — нейтральний (не впливає на індекс). */
  polarity: Polarity;
  /** Вага в індексі категорії (за замовчуванням 1). */
  weight?: number;
  /** Пункти з однаковою групою взаємовиключні (позначити можна лише один). */
  group?: string;
  /** Підзаголовок, під яким пункт стоїть на бланку. */
  section?: string;
}

export interface CategoryDef {
  id: CategoryId;
  title: string;
  scope: Scope;
  /** Чи рахується для категорії індекс за полярностями. */
  scored: boolean;
  items: ItemDef[];
}

export type HelpLevel = 'none' | 'periodic' | 'partial' | 'full';

/** Рівні допомоги в порядку шкали (від найменшої підтримки до найбільшої). */
export const HELP_LEVELS: { id: HelpLevel; label: string }[] = [
  { id: 'none', label: 'не потрібна' },
  { id: 'periodic', label: 'періодично' },
  { id: 'partial', label: 'частково' },
  { id: 'full', label: 'в усьому' },
];

/** Порядок, у якому рівні надруковані на паперовому бланку (+ «не потрібна»). */
export const PAPER_HELP_ORDER: HelpLevel[] = ['none', 'partial', 'periodic', 'full'];

export const HELP_LABEL: Record<HelpLevel, string> = {
  none: 'не потрібна',
  periodic: 'періодично',
  partial: 'частково',
  full: 'в усьому',
};

export const LEARNING: CategoryDef = {
  id: 'learning',
  title: 'Навчальна діяльність',
  scope: 'lesson',
  scored: true,
  items: [
    { id: 'learn.active', label: 'Активно працює на уроці', polarity: 1 },
    { id: 'learn.no_desire', label: 'Відсутнє бажання вчитися', polarity: -1 },
    { id: 'learn.reluctant', label: 'Неохоче виконує завдання', polarity: -1 },
    { id: 'learn.interest', label: 'Проявляє інтерес у набутті нових знань', polarity: 1 },
    { id: 'learn.indifferent', label: 'Байдужість до нових знань', polarity: -1 },
    { id: 'learn.hard_focus', label: 'Важко зосереджується', polarity: -1 },
    { id: 'learn.cooperates', label: 'Співпрацює з іншими/ працює в групі', polarity: 1 },
    { id: 'learn.independent', label: 'Проявляє самостійність на уроці', polarity: 1 },
    // Підтримку вимірює блок «Взаємодія з асистентом», тому тут пункт нейтральний.
    { id: 'learn.with_assistant', label: 'Працює з допомогою асистента', polarity: 0 },
    { id: 'learn.initiative', label: 'Виявляє ініціативу в процесі навчання', polarity: 1 },
  ],
};

export const ATTENTION: CategoryDef = {
  id: 'attention',
  title: 'Увага',
  scope: 'lesson',
  scored: true,
  items: [
    { id: 'att.stable', label: 'Стійка', polarity: 1, group: 'att.stability' },
    { id: 'att.unstable', label: 'Не стійка', polarity: -1, group: 'att.stability' },
    { id: 'att.voluntary', label: 'Довільна', polarity: 1, group: 'att.type' },
    { id: 'att.involuntary', label: 'Мимовільна', polarity: -1, group: 'att.type' },
  ],
};

export const EMOTION: CategoryDef = {
  id: 'emotion',
  title: 'Емоційний стан',
  scope: 'lesson',
  scored: true,
  items: [
    { id: 'emo.positive', label: 'Позитивний', polarity: 1, group: 'emo.valence' },
    { id: 'emo.negative', label: 'Негативний', polarity: -1, group: 'emo.valence' },
    { id: 'emo.stable', label: 'Стійкий', polarity: 1, group: 'emo.stability' },
    { id: 'emo.anxious', label: 'Схвильований', polarity: -1, group: 'emo.stability' },
    { id: 'emo.indifferent', label: 'Байдужий', polarity: -1 },
  ],
};

export const BEHAVIOR: CategoryDef = {
  id: 'behavior',
  title: 'Поведінка',
  scope: 'lesson',
  scored: true,
  items: [
    { id: 'beh.adequate', label: 'Адекватна', polarity: 1 },
    { id: 'beh.impulsive', label: 'Імпульсивна', polarity: -1 },
    { id: 'beh.tires', label: 'Швидко втомлюється', polarity: -1 },
    { id: 'beh.distracted', label: 'Легко відволікається', polarity: -1 },
    { id: 'beh.low_motivation', label: 'Низька мотивація', polarity: -1 },
    { id: 'beh.stubborn', label: 'Упертість', polarity: -1 },
    { id: 'beh.mood_swings', label: 'Швидкі зміни настрою', polarity: -1 },
  ],
};

export const TEACHER: CategoryDef = {
  id: 'teacher',
  title: 'Взаємодія з вчителем',
  scope: 'lesson',
  scored: true,
  items: [
    { id: 'tch.attends', label: 'Звертає увагу на вчителя', polarity: 1 },
    { id: 'tch.ignores', label: 'Не реагує/ігнорує', polarity: -1 },
    { id: 'tch.general_address', label: 'Сприймає загальне звернення', polarity: 1 },
    { id: 'tch.needs_personal', label: 'Потребує особистого звернення', polarity: -1 },
    { id: 'tch.listens', label: 'Слухає і чує вчителя', polarity: 1 },
    { id: 'tch.understands', label: 'Розуміє завдання від вчителя', polarity: 1 },
    { id: 'tch.leading_questions', label: 'Навідні питання/ дод. пояснення', polarity: -1 },
    { id: 'tch.passive', label: 'Пасивний з класом', polarity: -1 },
    { id: 'tch.by_analogy', label: 'Працює за аналогією', polarity: 0 },
    { id: 'tch.unfinished', label: 'Не доводить справу до кінця', polarity: -1 },
  ],
};

/**
 * Взаємодія з асистентом: рівень допомоги зберігається окремим полем (helpLevel),
 * а організаційна допомога й адаптації — як пункти. Індекс категорії не рахується:
 * з цих даних виводиться індекс «Самостійність».
 */
export const ASSISTANT: CategoryDef = {
  id: 'assistant',
  title: 'Взаємодія з асистентом вчителя',
  scope: 'lesson',
  scored: false,
  items: [
    { id: 'ast.org_help', label: 'Організаційна допомога', polarity: 0 },
    { id: 'ast.visuals', label: 'Підготовка наочності', polarity: 0, section: 'Адаптація' },
    { id: 'ast.leading_questions', label: 'Навідні питання', polarity: 0, section: 'Адаптація' },
    { id: 'ast.more_time', label: 'Збільшення часу на виконання завдань', polarity: 0, section: 'Адаптація' },
    { id: 'ast.duplication', label: 'Дублювання завдань, питань', polarity: 0, section: 'Адаптація' },
    { id: 'ast.explanations', label: 'Індивідуальні додаткові пояснення', polarity: 0, section: 'Адаптація' },
    { id: 'ast.activation', label: 'Додаткова активізація/концентрація', polarity: 0, section: 'Адаптація' },
    { id: 'ast.encouragement', label: 'Потребує заохочення /мотивації', polarity: 0, section: 'Адаптація' },
  ],
};

export const SOCIAL: CategoryDef = {
  id: 'social',
  title: 'Комунікативні та соціальні навички',
  scope: 'day',
  scored: true,
  items: [
    { id: 'soc.own_initiative', label: 'За власною ініціативою', polarity: 1, section: 'Спілкується' },
    { id: 'soc.adult_initiative', label: 'За ініціативою дорослого', polarity: 0, section: 'Спілкується' },
    { id: 'soc.peer_initiative', label: 'За ініціативою однолітка', polarity: 0, section: 'Спілкується' },
    { id: 'soc.limited_circle', label: 'З обмеженим колом людей', polarity: -1, section: 'Спілкується' },
    { id: 'soc.willing_contact', label: 'Охоче вступає в контакт', polarity: 1 },
    { id: 'soc.withdrawn', label: 'Замкнутий, нетовариський', polarity: -1 },
    { id: 'soc.understands_peers', label: 'Розуміє однолітків', polarity: 1, group: 'soc.peers' },
    { id: 'soc.not_understands_peers', label: 'Не розуміє однолітків', polarity: -1, group: 'soc.peers' },
    { id: 'soc.imitates', label: 'Наслідує дітей', polarity: 0 },
    { id: 'soc.cooperates', label: 'Співпрацює з дітьми', polarity: 1 },
    { id: 'soc.conflicts', label: 'Конфліктує', polarity: -1 },
    { id: 'soc.empathy', label: 'Вміє співпереживати', polarity: 1, group: 'soc.empathy' },
    { id: 'soc.no_empathy', label: 'Не проявляє співчуття', polarity: -1, group: 'soc.empathy' },
    {
      id: 'soc.accepts_criticism',
      label: 'Адекватно реагує на зауваження або критику',
      polarity: 1,
      group: 'soc.criticism',
    },
    {
      id: 'soc.ignores_criticism',
      label: 'Не звертає увагу на зауваження або критику',
      polarity: -1,
      group: 'soc.criticism',
    },
    { id: 'soc.asks_help', label: 'Вміє просити допомогу', polarity: 1 },
    { id: 'soc.respect', label: 'Проявляє повагу до інших людей', polarity: 1 },
    { id: 'soc.respect_almost_always', label: 'Майже завжди проявляє належну повагу до інших', polarity: 1 },
    {
      id: 'soc.active_class',
      label: 'Бере активну участь у справах класу',
      polarity: 1,
      group: 'soc.class_activity',
    },
    {
      id: 'soc.passive_but_complies',
      label: 'Не проявляє активності в суспільному житті, але доручення виконує',
      polarity: 0,
      group: 'soc.class_activity',
    },
    {
      id: 'soc.prefers_individual',
      label: 'Віддає перевагу індивідуальним формам роботи й відпочинку',
      polarity: 0,
    },
    { id: 'soc.follows_rules', label: 'Слідує правилам поведінки', polarity: 1, group: 'soc.rules' },
    { id: 'soc.breaks_rules', label: 'Не дотримується правил', polarity: -1, group: 'soc.rules' },
  ],
};

export const CATEGORIES: CategoryDef[] = [LEARNING, ATTENTION, EMOTION, BEHAVIOR, TEACHER, ASSISTANT, SOCIAL];
export const LESSON_CATEGORIES = CATEGORIES.filter((c) => c.scope === 'lesson');
export const SCORED_LESSON_CATEGORIES = LESSON_CATEGORIES.filter((c) => c.scored);

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  CategoryDef
>;

export const ALL_ITEMS: ItemDef[] = CATEGORIES.flatMap((c) => c.items);
export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));
export const CATEGORY_OF_ITEM: Record<string, CategoryId> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.items.map((i) => [i.id, c.id])),
);

/** Адаптації та організаційна допомога — з них рахується частка застосованих адаптацій. */
export const ADAPTATION_IDS = ASSISTANT.items.map((i) => i.id);

/** Пункти, що належать до тієї ж групи взаємовиключення (без самого пункту). */
export function exclusiveSiblings(itemId: string): string[] {
  const item = ITEM_BY_ID[itemId];
  if (!item?.group) return [];
  return ALL_ITEMS.filter((i) => i.group === item.group && i.id !== itemId).map((i) => i.id);
}

/** Перемикає пункт з урахуванням взаємовиключних груп. Повертає новий масив. */
export function toggleCheck(checks: string[], itemId: string): string[] {
  if (checks.includes(itemId)) return checks.filter((id) => id !== itemId);
  const siblings = new Set(exclusiveSiblings(itemId));
  return [...checks.filter((id) => !siblings.has(id)), itemId];
}
