import * as XLSX from 'xlsx';
import { XLSX_MIME, rawDataWorkbook, type Dataset } from '@journal/core';

/** Книга будується в ядрі — тут лише перетворення у файл для браузера. */
export function rawDataXlsx(ds: Dataset): Blob {
  const out = XLSX.write(rawDataWorkbook(ds), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([out], { type: XLSX_MIME });
}
