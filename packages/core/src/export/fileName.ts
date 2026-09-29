/** Ім'я файлу без недопустимих символів: «Журнал_Андрій_К_2025-11.pdf». */
export const safeFileName = (s: string) =>
  s
    .replace(/[\\/:*?"<>|.,]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
