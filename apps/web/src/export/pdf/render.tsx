import { pdf } from '@react-pdf/renderer';
import type { Student } from '@journal/core';
import type { ChartImage } from '../chartImage';
import type { ReportModel } from '@journal/core';
import type { SheetDay } from '@journal/core';
import { registerFonts } from './kit';
import { JournalDocument } from './JournalPdf';
import { ReportDocument } from './ReportPdf';

export async function journalPdf(student: Student, days: SheetDay[], title: string): Promise<Blob> {
  registerFonts();
  return pdf(<JournalDocument student={student} days={days} title={title} />).toBlob();
}

export async function reportPdf(
  student: Student,
  period: string,
  report: ReportModel,
  charts: ChartImage[],
  generatedAt: string,
): Promise<Blob> {
  registerFonts();
  return pdf(<ReportDocument student={student} period={period} report={report} charts={charts} generatedAt={generatedAt} />).toBlob();
}
