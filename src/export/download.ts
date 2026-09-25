export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Ім'я файлу без недопустимих символів: «Журнал_Андрій_К_2025-11.pdf». */
export const safeFileName = (s: string) =>
  s
    .replace(/[\\/:*?"<>|.,]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
