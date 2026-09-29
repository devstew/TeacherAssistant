import type { ReactNode } from 'react';
import type { CategoryDef, ItemDef } from '@journal/core';
import { Card, Chip, Segmented } from '../../components/ui';

type Block =
  | { kind: 'segmented'; section?: string; items: ItemDef[] }
  | { kind: 'chips'; section?: string; items: ItemDef[] };

/** Пари з короткими підписами показуємо як перемикач, довгі — як взаємовиключні чипи. */
const SEGMENT_MAX_LABEL = 14;

function blocksOf(items: ItemDef[]): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < items.length; ) {
    const item = items[i];
    if (item.group) {
      const group = items.filter((x) => x.group === item.group);
      if (group.every((g) => g.label.length <= SEGMENT_MAX_LABEL)) {
        out.push({ kind: 'segmented', section: item.section, items: group });
        i += group.length;
        continue;
      }
    }
    const last = out[out.length - 1];
    if (last?.kind === 'chips' && last.section === item.section) last.items.push(item);
    else out.push({ kind: 'chips', section: item.section, items: [item] });
    i++;
  }
  return out;
}

export function CategoryBlock({
  cat,
  checks,
  onToggle,
  items = cat.items,
  before,
  children,
  title = cat.title,
}: {
  cat: CategoryDef;
  checks: string[];
  /** Перемкнути пункт (взаємовиключні групи враховує toggleCheck). */
  onToggle: (itemId: string) => void;
  items?: ItemDef[];
  /** Вміст перед пунктами (напр. рівень допомоги асистента). */
  before?: ReactNode;
  children?: ReactNode;
  title?: string;
}) {
  const blocks = blocksOf(items);
  let prevSection: string | undefined;
  return (
    <Card title={title}>
      <div className="space-y-3">
        {before}
        {blocks.map((b, i) => {
          const heading = b.section && b.section !== prevSection ? b.section : undefined;
          prevSection = b.section;
          return (
            <div key={i}>
              {heading && <div className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{heading}:</div>}
              {b.kind === 'segmented' ? (
                <Segmented
                  label={b.items.map((x) => x.label).join(' / ')}
                  options={b.items.map((x) => ({ id: x.id, label: x.label }))}
                  value={b.items.find((x) => checks.includes(x.id))?.id}
                  onChange={(v) => {
                    const current = b.items.find((x) => checks.includes(x.id))?.id;
                    if (v ?? current) onToggle((v ?? current)!);
                  }}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {b.items.map((x) => (
                    <Chip key={x.id} on={checks.includes(x.id)} onClick={() => onToggle(x.id)}>
                      {x.label}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {children}
      </div>
    </Card>
  );
}
