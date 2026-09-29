/** Спільні примітиви PDF: шрифт з кирилицею, квадратики бланку, таблиці. */
import { Font, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';

let fontsReady = false;

/** base — тека зі шрифтами (у браузері — ./fonts/ поруч із застосунком; у тестах — шлях на диску). */
export function registerFonts(base?: string): void {
  if (fontsReady) return;
  base ??= new URL('fonts/', document.baseURI).href;
  Font.register({
    family: 'NotoSans',
    fonts: [
      { src: `${base}NotoSans-Regular.ttf` },
      { src: `${base}NotoSans-Bold.ttf`, fontWeight: 'bold' },
    ],
  });
  // Типове перенесення розраховане на англійську й ламає українські слова.
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

export const INK = '#1f2328';
export const MUTED = '#6b6b66';
export const LINE = '#4b4b48';
export const GREEN = '#dcebd0';
export const BEIGE = '#f3e0d3';

export const k = StyleSheet.create({
  page: { fontFamily: 'NotoSans', fontSize: 7.4, color: INK, paddingTop: 22, paddingBottom: 30, paddingHorizontal: 22 },
  item: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 1.6 },
  // flex: 1 — текст займає рівно залишок ширини після квадратика й переноситься в ній.
  // Без lineHeight: у react-pdf 4.x безрозмірне значення роздуває рядок удвічі.
  itemText: { flex: 1 },
  box: {
    width: 7,
    height: 7,
    borderWidth: 0.7,
    borderColor: '#333333',
    marginRight: 3,
    marginTop: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: INK, borderColor: INK },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 22,
    right: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 6.5,
    color: MUTED,
  },
});

export function Box({ on }: { on: boolean }) {
  return (
    <View style={on ? [k.box, k.boxOn] : k.box}>
      {on && (
        <Svg width={6} height={6} viewBox="0 0 10 10">
          <Path d="M1.6 5.3 L4.1 7.7 L8.6 2.5" stroke="#ffffff" strokeWidth={1.9} fill="none" />
        </Svg>
      )}
    </View>
  );
}

export function Item({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <View style={k.item}>
      <Box on={on} />
      <Text style={k.itemText}>{children}</Text>
    </View>
  );
}

export function Footer({ left }: { left: string }) {
  return (
    <View style={k.footer} fixed>
      <Text>{left}</Text>
      <Text render={({ pageNumber, totalPages }) => `стор. ${pageNumber} з ${totalPages}`} />
    </View>
  );
}

const t = StyleSheet.create({
  table: { borderTopWidth: 0.6, borderLeftWidth: 0.6, borderColor: LINE, marginBottom: 8 },
  row: { flexDirection: 'row' },
  cell: { borderRightWidth: 0.6, borderBottomWidth: 0.6, borderColor: LINE, paddingVertical: 2.5, paddingHorizontal: 3 },
  head: { backgroundColor: GREEN, fontWeight: 'bold' },
});

/** Проста таблиця: перша колонка ширша, решта ділять місце порівну. */
export function Table({ head, rows, firstWidth = 34, fontSize = 7.4 }: { head: string[]; rows: string[][]; firstWidth?: number; fontSize?: number }) {
  const rest = head.length > 1 ? (100 - firstWidth) / (head.length - 1) : 0;
  const width = (i: number) => `${i === 0 ? firstWidth : rest}%`;
  return (
    <View style={[t.table, { fontSize }]}>
      <View style={t.row} fixed>
        {head.map((h, i) => (
          <Text key={i} style={[t.cell, t.head, { width: width(i), textAlign: i === 0 ? 'left' : 'center' }]}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={t.row} wrap={false}>
          {r.map((c, i) => (
            <Text key={i} style={[t.cell, { width: width(i), textAlign: i === 0 ? 'left' : 'center' }]}>
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
