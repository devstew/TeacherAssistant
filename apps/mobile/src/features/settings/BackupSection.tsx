import { useState } from 'react';
import { Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Download, Upload } from 'lucide-react-native';
import { exportBackup, importBackup, parseBackup, safeFileName, todayISO } from '@journal/core';
import { Button, Card, Notice } from '@/components/ui';
import { shareText } from '@/export/documents';
import { useStudents } from '@/state/student';
import { font, sp, useTheme } from '@/theme';

const JSON_MIME = 'application/json';

/**
 * Резервна копія у файл і відновлення з нього. На телефоні це єдиний спосіб
 * дістати журнал назовні, якщо синхронізація вимкнена: видалення застосунку
 * стирає базу разом із ним.
 */
export function BackupSection() {
  const t = useTheme();
  const { student } = useStudents();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  const save = async (onlyCurrent: boolean) => {
    setBusy(true);
    setStatus(null);
    try {
      const backup = await exportBackup(onlyCurrent ? student?.id : undefined);
      const name = safeFileName(
        `Журнал_копія_${onlyCurrent && student ? `${student.name}_` : ''}${todayISO()}`,
      );
      const file = await shareText(JSON.stringify(backup), name, 'json', JSON_MIME);
      setStatus({ tone: 'good', text: `Готово: ${file}` });
    } catch (e) {
      setStatus({ tone: 'bad', text: e instanceof Error ? e.message : 'Не вдалося зберегти копію.' });
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setStatus(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: [JSON_MIME, 'public.json', '*/*'] });
    if (picked.canceled) return;
    setBusy(true);
    try {
      const text = await new File(picked.assets[0].uri).text();
      const result = await importBackup(parseBackup(JSON.parse(text)));
      setStatus({ tone: 'good', text: `Відновлено: записано ${result.written}, пропущено старіших ${result.skipped}.` });
    } catch (e) {
      setStatus({ tone: 'bad', text: e instanceof Error ? e.message : 'Не вдалося прочитати файл.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Резервна копія">
      <View style={{ gap: sp.md }}>
        <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
          Копія — це один файл JSON: надішліть його собі поштою або збережіть у «Файли». Під час відновлення записи
          зливаються: для кожного уроку залишається новіша версія.
        </Text>
        <Button disabled={busy} icon={<Download color={t.subtle} size={16} />} onPress={() => save(false)}>
          Уся база
        </Button>
        <Button disabled={busy || !student} icon={<Download color={t.subtle} size={16} />} onPress={() => save(true)}>
          Лише поточна дитина
        </Button>
        <Button disabled={busy} icon={<Upload color={t.subtle} size={16} />} onPress={restore}>
          Відновити з файлу
        </Button>
        {status && <Notice tone={status.tone}>{status.text}</Notice>}
      </View>
    </Card>
  );
}
