import ExcelJS from 'exceljs';
import { TemplateProfile, TemplateRole } from '../types';

/**
 * Parses an uploaded XLSX file to inspect sheet structure, column widths,
 * row heights, merges, and print settings.
 */
export async function parseUploadedTemplate(
  file: File,
  role: TemplateRole
): Promise<TemplateProfile> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const firstSheet = workbook.worksheets[0];
  if (!firstSheet) {
    throw new Error('엑셀 파일에 유효한 시트가 존재하지 않습니다.');
  }

  // Extract column widths
  const widths: Record<string, number> = {};
  firstSheet.columns?.forEach((col, idx) => {
    const colLetter = String.fromCharCode(65 + idx);
    if (col.width) {
      widths[colLetter] = col.width;
    }
  });

  // Extract row heights
  const rowHeights: Record<number, number> = {};
  for (let r = 1; r <= 35; r++) {
    const row = firstSheet.getRow(r);
    if (row && row.height) {
      rowHeights[r] = row.height;
    }
  }

  // Extract merges
  const merges: string[] = [];
  if ((firstSheet as any)._merges) {
    const rawMerges = (firstSheet as any)._merges;
    for (const key in rawMerges) {
      merges.push(rawMerges[key].model ? rawMerges[key].model.range : String(rawMerges[key]));
    }
  }

  // Extract print settings
  const pageSetup = firstSheet.pageSetup;
  const printSettings = pageSetup
    ? {
        orientation: pageSetup.orientation,
        fitToWidth: pageSetup.fitToWidth,
        fitToHeight: pageSetup.fitToHeight,
        margins: pageSetup.margins
          ? {
              left: pageSetup.margins.left || 0,
              right: pageSetup.margins.right || 0,
              top: pageSetup.margins.top || 0,
              bottom: pageSetup.margins.bottom || 0,
            }
          : undefined,
        horizontalCentered: pageSetup.horizontalCentered,
        paperSize: pageSetup.paperSize,
      }
    : undefined;

  // Convert to Base64 for persistent IndexedDB storage
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const originalBytesBase64 = btoa(binary);

  return {
    id: `template_${role}_${Date.now()}`,
    role,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
    fileSizeBytes: file.size,
    sourceSheetName: firstSheet.name,
    widths,
    rowHeights,
    merges,
    printSettings,
    originalBytesBase64,
  };
}
