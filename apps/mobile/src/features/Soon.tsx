import { Text, View } from 'react-native';
import { font, sp, useTheme } from '@/theme';

/** Заглушка екрана, який ще переносимо з вебу: чесно каже, що тут буде. */
export function Soon({ what, hint }: { what: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: sp.sm }}>
      <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>{what}</Text>
      <Text style={{ color: t.muted, fontSize: font.xs }}>{hint ?? 'Переносимо з веб-версії — буде в наступному оновленні.'}</Text>
    </View>
  );
}
