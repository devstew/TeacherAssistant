/**
 * Документи на телефоні: HTML з ядра друкується в PDF системним рушієм
 * (`expo-print` → WKWebView/Android Print), решта форматів пишеться у файл.
 * Готовий файл завжди йде в системне «Поділитися» — так асистент надсилає
 * його в месенджер, пошту або зберігає у «Файли», не шукаючи теку.
 */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { bytesFromBase64, safeFileName } from '@journal/core';

async function share(uri: string, mimeType: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Пристрій не вміє ділитися файлами.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: mimeType === PDF ? 'com.adobe.pdf' : undefined });
}

const PDF = 'application/pdf';

/**
 * Кеш очищається системою — саме там і місце тимчасовим документам.
 * Файл тут лише називається: створювати його наперед не можна, бо переміщення
 * надрукованого PDF на зайняте ім'я падає помилкою.
 */
function cacheFile(name: string, extension: string): File {
  const file = new File(Paths.cache, `${safeFileName(name)}.${extension}`);
  if (file.exists) file.delete();
  return file;
}

/** HTML → PDF → «Поділитися». Повертає назву файлу, щоб показати її користувачу. */
export async function sharePdf(html: string, name: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const target = cacheFile(name, 'pdf');
  // Системний друк дає файл із випадковою назвою — перейменовуємо, бо саме
  // цю назву побачить директор у вкладенні.
  await new File(uri).move(target, { overwrite: true });
  await share(target.uri, PDF, name);
  return target.name;
}

/** Файл із двійкових даних у base64 (Excel зі SheetJS). */
export async function shareBase64(base64: string, name: string, extension: string, mimeType: string): Promise<string> {
  const file = cacheFile(name, extension);
  file.create();
  file.write(bytesFromBase64(base64));
  await share(file.uri, mimeType, name);
  return file.name;
}

/** Текстовий файл (резервна копія JSON). */
export async function shareText(text: string, name: string, extension: string, mimeType: string): Promise<string> {
  const file = cacheFile(name, extension);
  file.create();
  file.write(text);
  await share(file.uri, mimeType, name);
  return file.name;
}
