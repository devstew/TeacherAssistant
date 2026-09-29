/**
 * Ті самі дванадцять примітивів, що у вебі, але на компонентах React Native.
 * Вигляд і поведінка збігаються навмисно: один журнал, два пристрої.
 */
import { type ReactNode, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { TAP, font, radius, sp, useTheme, type Theme, type Tone } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Рядок усередині кнопки чи позначки сам стає текстом — як у вебі. */
function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return typeof children === 'string' || typeof children === 'number' ? <Text style={style}>{children}</Text> : <>{children}</>;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  onPress,
  disabled,
  icon,
  children,
  style,
  accessibilityLabel,
}: {
  variant?: Variant;
  size?: 'sm' | 'md';
  onPress?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  /** Кнопка може бути й самим значком — напр. «видалити» в рядку списку. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Потрібен кнопці без підпису — самим значком. */
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const fill = variant === 'primary' ? t.brand : variant === 'ghost' ? 'transparent' : t.surface;
  const ink = variant === 'primary' ? t.onBrand : variant === 'danger' ? t.danger : t.subtle;
  const border = variant === 'secondary' ? t.ring : variant === 'danger' ? t.dangerRing : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: size === 'sm' ? 36 : TAP,
          paddingHorizontal: size === 'sm' ? sp.md : sp.lg,
          borderRadius: radius.sm,
          borderWidth: variant === 'secondary' || variant === 'danger' ? 1 : 0,
          borderColor: border,
          backgroundColor: fill,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: sp.sm,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {icon}
      {children != null && children !== '' && (
        <Label style={{ color: ink, fontSize: font.sm, fontWeight: '600' }}>{children}</Label>
      )}
    </Pressable>
  );
}

export function Card({
  title,
  actions,
  children,
  style,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        { backgroundColor: t.surface, borderRadius: radius.md, borderWidth: 1, borderColor: t.line, padding: sp.lg },
        style,
      ]}
    >
      {(title || actions) && (
        <View style={styles.cardHead}>
          <Label style={{ color: t.text, fontSize: font.md, fontWeight: '600', flexShrink: 1 }}>{title}</Label>
          {actions}
        </View>
      )}
      {children}
    </View>
  );
}

/** Перемикач-пункт бланку: головний елемент усього застосунку. */
export function Chip({ on, onPress, children }: { on: boolean; onPress: () => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: TAP,
        justifyContent: 'center',
        paddingHorizontal: 14,
        paddingVertical: sp.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: on ? t.brand : t.ring,
        backgroundColor: on ? t.brand : t.surface,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Label style={{ color: on ? t.onBrand : t.subtle, fontSize: font.sm }}>{children}</Label>
    </Pressable>
  );
}

/** Вибір одного варіанту; повторне натискання знімає вибір. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value?: T;
  onChange: (v: T | undefined) => void;
  label?: string;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.segmented, { backgroundColor: t.dark ? t.line : '#f1f5f9' }]}
    >
      {options.map((o) => {
        const on = value === o.id;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(on ? undefined : o.id)}
            style={{
              minHeight: 38,
              justifyContent: 'center',
              paddingHorizontal: 14,
              borderRadius: radius.sm,
              backgroundColor: on ? t.brand : 'transparent',
            }}
          >
            <Text style={{ color: on ? t.onBrand : t.subtle, fontSize: font.sm }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={style}>
      <Text style={{ color: t.subtle, fontSize: font.sm, fontWeight: '600', marginBottom: sp.xs }}>{label}</Text>
      {children}
      {hint && <Text style={{ color: t.muted, fontSize: font.xs, marginTop: sp.xs }}>{hint}</Text>}
    </View>
  );
}

function inputStyle(t: Theme, focused: boolean) {
  return {
    minHeight: TAP,
    borderRadius: radius.sm,
    borderWidth: focused ? 2 : 1,
    borderColor: focused ? t.brand : t.ring,
    backgroundColor: t.surface,
    color: t.text,
    fontSize: font.md,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
  };
}

export function Input({ style, ...props }: TextInputProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[inputStyle(t, focused), style]}
    />
  );
}

export function Textarea({ style, ...props }: TextInputProps) {
  return <Input multiline textAlignVertical="top" {...props} style={[{ minHeight: 96 }, style]} />;
}

/** Заміна `<select>`: список варіантів у модальному вікні. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Виберіть…',
  label,
}: {
  value?: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  placeholder?: string;
  label?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: current?.label }}
        onPress={() => setOpen(true)}
        style={[inputStyle(t, false), styles.selectBox]}
      >
        <Text numberOfLines={1} style={{ color: current ? t.text : t.muted, fontSize: font.md, flexShrink: 1 }}>
          {current?.label ?? placeholder}
        </Text>
        <Text style={{ color: t.muted, fontSize: font.sm }}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: t.surface }]} onPress={() => {}}>
            {label && (
              <Text style={{ color: t.muted, fontSize: font.sm, padding: sp.lg, paddingBottom: sp.sm }}>{label}</Text>
            )}
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.id}
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  style={{ minHeight: TAP + 6, justifyContent: 'center', paddingHorizontal: sp.lg, paddingVertical: sp.md }}
                >
                  <Text style={{ color: o.id === value ? t.brandInk : t.text, fontSize: font.md }}>
                    {o.id === value ? '• ' : ''}
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const t = useTheme();
  const c = t.tones[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: radius.full, paddingHorizontal: sp.sm, paddingVertical: 3 }}>
      <Label style={{ color: c.fg, fontSize: font.xs, fontWeight: '600' }}>{children}</Label>
    </View>
  );
}

export function Notice({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const t = useTheme();
  const c = t.tones[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: radius.sm, paddingHorizontal: sp.md, paddingVertical: sp.sm }}>
      <Label style={{ color: c.fg, fontSize: font.sm, lineHeight: 20 }}>{children}</Label>
    </View>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.pageTitle}>
      <View style={{ flexShrink: 1 }}>
        <Text style={{ color: t.text, fontSize: font.xl, fontWeight: '700' }}>{title}</Text>
        {subtitle && <Text style={{ color: t.muted, fontSize: font.sm, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {actions && <View style={styles.row}>{actions}</View>}
    </View>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ borderBottomWidth: 1, borderBottomColor: t.line, marginBottom: sp.lg, flexGrow: 0 }}
      contentContainerStyle={{ gap: sp.xs }}
    >
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(tab.id)}
            style={{
              minHeight: TAP,
              justifyContent: 'center',
              paddingHorizontal: sp.md,
              borderBottomWidth: 2,
              borderBottomColor: on ? t.brand : 'transparent',
            }}
          >
            <Text style={{ color: on ? t.brandInk : t.muted, fontSize: font.sm, fontWeight: '600' }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.md,
    marginBottom: sp.md,
  },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', borderRadius: radius.md, padding: 4, gap: 2 },
  selectBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.sm },
  // Абсолютна рамка, а не flex: 1 — інакше контейнер модалки може мати нульову висоту.
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: { maxHeight: '70%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: sp.xl },
  pageTitle: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: sp.md, marginBottom: sp.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
});
