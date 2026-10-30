import ExcelJS from 'exceljs';
import { Candidate, InterviewRecord, ReportBatch, TemplateProfile } from '../types';
import { generateMonthCalendarGrid, getRolling12Months } from './calendarCalc';

// 0.8 cm in inches: 0.8 / 2.54 = ~0.31496
const MARGIN_0_8_CM_INCHES = 0.8 / 2.54;

const PEACH_COLOR = 'FFFCE4D6';
const LIGHT_BLUE_COLOR = 'FFD9E1F2';
const BORDER_COLOR_GRAY = 'FFBFBFBF';
const BORDER_COLOR_BLUE = 'FF2F5597';

/**
 * Generates the Recruitment Interviewees Excel file (.xlsx)
 * - Sheet 1: Active Report Batch ("YYYY-MM-DD_면접")
 * - Sheet 2: Master Cumulative List ("종합")
 * - Formatted to exact construction HR standards:
 *   - Column widths A: 4, B: 10.5, C: 5.5, D: 7, E: 7.5, F: 17, G: 7, H: 15.5, I: 14.5,
 *     J: 23, K: 8, L: 11.5, M: 1.8, N: 11.5, O: 11, P: 15.5, Q: 10 (hidden), R: 7.5
 *   - Row height: 17pt for body rows
 *   - J:O top merged "주요경력사항", subheaders J:勤務處, K:職位, L:入社日, M:~, N:退社日(勤務中), O:經歷期間
 *   - 계 merged J:N, center aligned
 *   - Borders: hair, thin, no lines on blank margins
 *   - Print settings: Landscape, FitToPage 1x1, 0.8cm margins, Horizontally centered, A4 paper
 */
export async function generateRecruitReportWorkbook(options: {
  batch: ReportBatch;
  batchRecords: InterviewRecord[];
  allConfirmedRecords: InterviewRecord[];
  candidatesMap: Map<string, Candidate>;
  templateProfile?: TemplateProfile;
}): Promise<Blob> {
  const { batch, batchRecords, allConfirmedRecords, candidatesMap } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '채용_면접 시스템';
  workbook.lastModifiedBy = '인사팀';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Helper to build a candidate sheet
  function buildCandidateSheet(
    sheetName: string,
    records: InterviewRecord[],
    titleText: string,
    isMasterCumulative: boolean
  ) {
    const ws = workbook.addWorksheet(sheetName, {
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: isMasterCumulative ? 1 : 1,
        paperSize: 9, // A4
        margins: {
          left: MARGIN_0_8_CM_INCHES,
          right: MARGIN_0_8_CM_INCHES,
          top: 0.75,
          bottom: 0.75,
          header: 0.3,
          footer: 0.3,
        },
        horizontalCentered: true,
      },
      views: [{ showGridLines: true }],
    });

    // Column widths
    ws.columns = [
      { key: 'colA', width: 4.5 }, // A: 순번
      { key: 'colB', width: 11.0 }, // B: 면접일정
      { key: 'colC', width: 6.0 }, // C: 직종
      { key: 'colD', width: 7.5 }, // D: 성명
      { key: 'colE', width: 8.5 }, // E: 생년
      { key: 'colF', width: 17.5 }, // F: 최종학력
      { key: 'colG', width: 8.0 }, // G: 주소
      { key: 'colH', width: 16.0 }, // H: 연락처
      { key: 'colI', width: 15.0 }, // I: 자격사항
      { key: 'colJ', width: 23.5 }, // J: 근무처
      { key: 'colK', width: 8.5 }, // K: 직위
      { key: 'colL', width: 12.0 }, // L: 입사일
      { key: 'colM', width: 2.2 }, // M: ~
      { key: 'colN', width: 12.0 }, // N: 퇴사일(근무중)
      { key: 'colO', width: 11.5 }, // O: 경력기간
      { key: 'colP', width: 16.0 }, // P: 희망연봉
      { key: 'colQ', width: 10.0, hidden: true }, // Q: 예정직급(연봉) [숨김]
      { key: 'colR', width: 8.0 }, // R: 배치현장
    ];

    // Row 1: Title
    const titleRow = ws.getRow(1);
    titleRow.height = 28;
    ws.mergeCells('A1:R1');
    const titleCell = ws.getCell('A1');
    titleCell.value = titleText;
    titleCell.font = { name: '맑은 고딕', size: 16, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 2 & 3: Headers
    const row2 = ws.getRow(2);
    const row3 = ws.getRow(3);
    row2.height = 20;
    row3.height = 20;

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: PEACH_COLOR },
    };

    const headerBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };

    const headerFont: Partial<ExcelJS.Font> = {
      name: '맑은 고딕',
      size: 9.5,
      bold: true,
    };

    // Columns merged vertically (A2:A3, B2:B3, etc.)
    const verticalMergedCols = [
      { col: 'A', text: '순번' },
      { col: 'B', text: '면접일정' },
      { col: 'C', text: '직종' },
      { col: 'D', text: '성명' },
      { col: 'E', text: '생년' },
      { col: 'F', text: '최종학력' },
      { col: 'G', text: '주소' },
      { col: 'H', text: '연락처' },
      { col: 'I', text: '자격사항' },
      { col: 'P', text: '희망연봉' },
      { col: 'Q', text: '예정직급(연봉)' },
      { col: 'R', text: '배치현장' },
    ];

    for (const item of verticalMergedCols) {
      ws.mergeCells(`${item.col}2:${item.col}3`);
      const c = ws.getCell(`${item.col}2`);
      c.value = item.text;
      c.fill = headerFill;
      c.font = headerFont;
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      c.border = headerBorder;
      ws.getCell(`${item.col}3`).border = headerBorder;
    }

    // J2:O2: 주요경력사항
    ws.mergeCells('J2:O2');
    const careerHeader = ws.getCell('J2');
    careerHeader.value = '주요경력사항';
    careerHeader.fill = headerFill;
    careerHeader.font = headerFont;
    careerHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    careerHeader.border = headerBorder;

    // Subheaders in row 3
    const subHeaders = [
      { col: 'J', text: '근무처' },
      { col: 'K', text: '직위' },
      { col: 'L', text: '입사일' },
      { col: 'M', text: '~' },
      { col: 'N', text: '퇴사일(근무중)' },
      { col: 'O', text: '경력기간' },
    ];

    for (const sh of subHeaders) {
      const c = ws.getCell(`${sh.col}3`);
      c.value = sh.text;
      c.fill = headerFill;
      c.font = headerFont;
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.border = headerBorder;
      ws.getCell(`${sh.col}2`).border = headerBorder;
    }

    // Populate candidate blocks
    let currentRow = 4;
    let sequenceNumber = 1;

    // Sort records: for master cumulative, sort by interviewDateTime descending, unscheduled last
    const recordsToRender = [...records].sort((a, b) => {
      const dateA = a.interviewDateTime || '0000-00-00';
      const dateB = b.interviewDateTime || '0000-00-00';
      return dateB.localeCompare(dateA);
    });

    for (const rec of recordsToRender) {
      const candidate = candidatesMap.get(rec.candidateId);
      const periods = rec.employmentPeriods && rec.employmentPeriods.length > 0
        ? rec.employmentPeriods
        : [
            {
              id: 'empty',
              companyRaw: '기재내용 없음',
              startDate: '',
              endDate: '',
              isCurrentlyEmployed: false,
              position: '미기재',
              months: 0,
              durationDisplay: '0년 0개월',
              order: 1,
            },
          ];

      const hasDeduction = rec.degreeDeductionMonths > 0;
      const totalBlockRows = periods.length + (hasDeduction ? 1 : 0) + 1; // periods + deduction + '계'
      const startRow = currentRow;
      const endRow = startRow + totalBlockRows - 1;

      // Render career periods
      periods.forEach((period, pIdx) => {
        const rowNum = startRow + pIdx;
        const row = ws.getRow(rowNum);
        row.height = 17;

        // J: 근무처
        const cellJ = ws.getCell(`J${rowNum}`);
        cellJ.value = period.companyRaw;
        cellJ.alignment = { vertical: 'middle', horizontal: 'left' };
        cellJ.font = { name: '맑은 고딕', size: 9 };
        cellJ.border = {
          top: { style: 'thin' },
          bottom: { style: pIdx === periods.length - 1 && !hasDeduction ? 'thin' : 'hair' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };

        // K: 직위
        const cellK = ws.getCell(`K${rowNum}`);
        cellK.value = period.position || '미기재';
        cellK.alignment = { vertical: 'middle', horizontal: 'center' };
        cellK.font = { name: '맑은 고딕', size: 9 };
        cellK.border = cellJ.border;

        // L: 입사일
        const cellL = ws.getCell(`L${rowNum}`);
        cellL.value = period.startDate;
        cellL.alignment = { vertical: 'middle', horizontal: 'center' };
        cellL.font = { name: '맑은 고딕', size: 9 };
        cellL.border = cellJ.border;

        // M: ~
        const cellM = ws.getCell(`M${rowNum}`);
        cellM.value = '~';
        cellM.alignment = { vertical: 'middle', horizontal: 'center' };
        cellM.font = { name: '맑은 고딕', size: 8 };
        cellM.border = cellJ.border;

        // N: 퇴사일(근무중)
        const cellN = ws.getCell(`N${rowNum}`);
        cellN.value = period.endDate || (period.isCurrentlyEmployed ? '근무중' : '');
        cellN.alignment = { vertical: 'middle', horizontal: 'center' };
        cellN.font = { name: '맑은 고딕', size: 9 };
        cellN.border = cellJ.border;

        // O: 경력기간
        const cellO = ws.getCell(`O${rowNum}`);
        cellO.value = period.durationDisplay;
        cellO.alignment = { vertical: 'middle', horizontal: 'center' };
        cellO.font = { name: '맑은 고딕', size: 9 };
        cellO.border = cellJ.border;
      });

      // Deduction row (if any)
      let deductionRowNum = -1;
      if (hasDeduction) {
        deductionRowNum = startRow + periods.length;
        const row = ws.getRow(deductionRowNum);
        row.height = 17;

        ws.mergeCells(`J${deductionRowNum}:N${deductionRowNum}`);
        const deductionLabelCell = ws.getCell(`J${deductionRowNum}`);
        deductionLabelCell.value = rec.degreeDeductionLabel || '전문학사 감산';
        deductionLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
        deductionLabelCell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FFC00000' } };
        deductionLabelCell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };

        const deductionValueCell = ws.getCell(`O${deductionRowNum}`);
        const deductionYears = rec.degreeDeductionMonths / 12;
        deductionValueCell.value = `-${deductionYears}년`;
        deductionValueCell.alignment = { vertical: 'middle', horizontal: 'center' };
        deductionValueCell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FFC00000' } };
        deductionValueCell.border = deductionLabelCell.border;
      }

      // '계' Total row
      const totalRowNum = endRow;
      const totalRow = ws.getRow(totalRowNum);
      totalRow.height = 17;

      ws.mergeCells(`J${totalRowNum}:N${totalRowNum}`);
      const totalLabelCell = ws.getCell(`J${totalRowNum}`);
      totalLabelCell.value = '계';
      totalLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
      totalLabelCell.font = { name: '맑은 고딕', size: 9.5, bold: true };
      totalLabelCell.fill = headerFill;
      totalLabelCell.border = {
        top: { style: 'thin' },
        bottom: { style: 'medium' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };

      const totalValCell = ws.getCell(`O${totalRowNum}`);
      totalValCell.value = rec.totalCareerDisplay;
      totalValCell.alignment = { vertical: 'middle', horizontal: 'center' };
      totalValCell.font = { name: '맑은 고딕', size: 9.5, bold: true };
      totalValCell.fill = headerFill;
      totalValCell.border = totalLabelCell.border;

      // Merge and fill Candidate Columns (A, B, C, D, E, F, G, H, I, P, Q, R) across all rows
      const mergedCandidateCols = [
        { col: 'A', value: sequenceNumber, align: 'center' },
        { col: 'B', value: rec.interviewDisplayString || rec.interviewDateTimeRaw || '', align: 'center' },
        { col: 'C', value: rec.jobTypeOverride || rec.handwrittenJobType || '', align: 'center' },
        { col: 'D', value: rec.candidateName, align: 'center', bold: true },
        { col: 'E', value: candidate?.birthYearDisplay || '', align: 'center' },
        { col: 'F', value: candidate?.educationDisplay || '', align: 'center' },
        { col: 'G', value: candidate?.addressCityCountyDistrict || '', align: 'center' },
        { col: 'H', value: candidate?.resumeContact || '', align: 'center' },
        { col: 'I', value: candidate?.qualificationsDisplay || '', align: 'center' },
        { col: 'P', value: rec.desiredSalaryDisplay || '', align: 'center' },
        { col: 'Q', value: '', align: 'center' }, // Q열 항상 공란
        { col: 'R', value: rec.placementOverride || rec.handwrittenPlacement || '', align: 'center' },
      ];

      for (const item of mergedCandidateCols) {
        if (startRow !== endRow) {
          ws.mergeCells(`${item.col}${startRow}:${item.col}${endRow}`);
        }
        const cell = ws.getCell(`${item.col}${startRow}`);
        cell.value = item.value;
        cell.font = { name: '맑은 고딕', size: 9, bold: Boolean(item.bold) };
        cell.alignment = {
          vertical: 'middle',
          horizontal: item.align as any,
          wrapText: true,
        };

        // Apply borders to all cells in the column block
        for (let r = startRow; r <= endRow; r++) {
          const c = ws.getCell(`${item.col}${r}`);
          c.border = {
            top: r === startRow ? { style: 'thin' } : undefined,
            bottom: r === endRow ? { style: 'medium' } : undefined,
            left: { style: 'thin' },
            right: { style: 'thin' },
          };
        }
      }

      currentRow = endRow + 1;
      sequenceNumber++;
    }

    // Set print area
    if (currentRow > 4) {
      ws.pageSetup.printArea = `A1:R${currentRow - 1}`;
    }
  }

  // 1. Build New Report Sheet (placed FIRST)
  const batchSheetName = (batch.sheetName || `${batch.reportDate}_면접`).slice(0, 31);
  buildCandidateSheet(
    batchSheetName,
    batchRecords,
    `경력직 면접대상자 (${batch.reportDate})`,
    false
  );

  // 2. Build Cumulative Sheet "종합" (placed SECOND)
  buildCandidateSheet(
    '종합',
    allConfirmedRecords,
    '경력직 면접대상자 종합 관리표',
    true
  );

  // Generate buffer and return Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generates the Monthly Interview Calendar Excel file (.xlsx)
 * - Contains 12 rolling month sheets (e.g. 2026-11 down to 2025-12)
 * - Sheet name: YYYY-MM
 * - First sheet is the latest month!
 * - A1:G1 title "면 접 일 정", G2 "YYYY년 MM월", A3:G3 Day names
 * - Day names: Sunday red, Saturday blue, light blue fill (#D9E1F2)
 * - Row heights: Title 30pt, YM 20.1pt, Day 21.75pt, Date & Content rows 17.5pt
 * - Column width: 15.78 characters
 * - Content slots: 성명(배치현장_직종) - 시간
 * - Shrink to fit, centered
 * - Print settings: Landscape, FitToPage 1x1, 0.8cm margins, Horizontally centered, A4
 */
export async function generateMonthlyCalendarWorkbook(options: {
  basisMonth: string; // YYYY-MM
  allRecords: InterviewRecord[];
}): Promise<Blob> {
  const { basisMonth, allRecords } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '채용_면접 시스템';
  workbook.lastModifiedBy = '인사팀';
  workbook.created = new Date();
  workbook.modified = new Date();

  const rollingMonths = getRolling12Months(basisMonth);

  for (const ym of rollingMonths) {
    const grid = generateMonthCalendarGrid(ym, allRecords);
    const ws = workbook.addWorksheet(ym, {
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        paperSize: 9, // A4
        margins: {
          left: MARGIN_0_8_CM_INCHES,
          right: MARGIN_0_8_CM_INCHES,
          top: 0.75,
          bottom: 0.75,
          header: 0.3,
          footer: 0.3,
        },
        horizontalCentered: true,
      },
      views: [{ showGridLines: true }],
    });

    // 7 Columns for Sun through Sat
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    ws.columns = cols.map((key) => ({ key, width: 15.78 }));

    // Row 1: Title
    const row1 = ws.getRow(1);
    row1.height = 30;
    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = '면  접  일  정';
    titleCell.font = { name: '맑은 고딕', size: 18, bold: true, color: { argb: 'FF1F4E79' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 2: Year-Month in G2
    const row2 = ws.getRow(2);
    row2.height = 20.1;
    const ymCell = ws.getCell('G2');
    ymCell.value = grid.yearMonthKorean;
    ymCell.font = { name: '맑은 고딕', size: 11, bold: true };
    ymCell.alignment = { vertical: 'middle', horizontal: 'right' };

    // Row 3: Weekday Headers
    const row3 = ws.getRow(3);
    row3.height = 21.75;
    const weekdays = [
      { name: '일', color: 'FFFF0000' }, // Red
      { name: '월', color: 'FF000000' },
      { name: '화', color: 'FF000000' },
      { name: '수', color: 'FF000000' },
      { name: '목', color: 'FF000000' },
      { name: '금', color: 'FF000000' },
      { name: '토', color: 'FF0070C0' }, // Blue
    ];

    weekdays.forEach((wd, i) => {
      const colLetter = cols[i];
      const cell = ws.getCell(`${colLetter}3`);
      cell.value = wd.name;
      cell.font = { name: '맑은 고딕', size: 10.5, bold: true, color: { argb: wd.color } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: LIGHT_BLUE_COLOR },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'medium', color: { argb: BORDER_COLOR_BLUE } },
        bottom: { style: 'medium', color: { argb: BORDER_COLOR_BLUE } },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Populate Weeks
    grid.weeks.forEach((week) => {
      // 1. Date row
      const dateRow = ws.getRow(week.dateRowNumber);
      dateRow.height = 17.5;

      week.days.forEach((day, colIdx) => {
        const colLetter = cols[colIdx];
        const cell = ws.getCell(`${colLetter}${week.dateRowNumber}`);
        cell.value = day.dayNumber !== null ? day.dayNumber : '';
        const isRedDate = day.isSunday || day.isHoliday;
        cell.font = {
          name: '맑은 고딕',
          size: 10,
          bold: true,
          color: isRedDate
            ? { argb: 'FFFF0000' } // 일요일 및 공휴일·대체공휴일·선거일 빨간색
            : day.isSaturday
            ? { argb: 'FF0070C0' } // 토요일 파란색
            : { argb: 'FF000000' }, // 평일 검정색
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: isRedDate
              ? (day.isHoliday ? 'FFFFE8E8' : 'FFFFF0F0') // 공휴일·대체공휴일·선거일 및 일요일 부드러운 빨간색/분홍빛 배경
              : 'FFF9FAFB',
          },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: BORDER_COLOR_GRAY } },
          bottom: { style: 'hair', color: { argb: BORDER_COLOR_GRAY } },
          left: { style: 'thin', color: { argb: BORDER_COLOR_GRAY } },
          right: { style: 'thin', color: { argb: BORDER_COLOR_GRAY } },
        };
      });

      // 2. Content rows (4 slots)
      for (let slot = 0; slot < 4; slot++) {
        const contentRowNum = week.contentRowStart + slot;
        const cRow = ws.getRow(contentRowNum);
        cRow.height = 17.5;

        week.days.forEach((day, colIdx) => {
          const colLetter = cols[colIdx];
          const cell = ws.getCell(`${colLetter}${contentRowNum}`);
          const item = day.slots[slot];

          if (item) {
            cell.value = item.text;
            cell.font = {
              name: '맑은 고딕',
              size: item.fontSizePt || 7.5,
              bold: false,
            };
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'center',
              shrinkToFit: true,
              wrapText: false,
            };
          } else {
            cell.value = '';
          }

          cell.border = {
            top: { style: 'hair', color: { argb: BORDER_COLOR_GRAY } },
            bottom:
              slot === 3
                ? { style: 'thin', color: { argb: BORDER_COLOR_GRAY } }
                : { style: 'hair', color: { argb: BORDER_COLOR_GRAY } },
            left: { style: 'thin', color: { argb: BORDER_COLOR_GRAY } },
            right: { style: 'thin', color: { argb: BORDER_COLOR_GRAY } },
          };
        });
      }
    });

    // Print Area
    const maxRow = 4 + grid.weeks.length * 5 - 1;
    ws.pageSetup.printArea = `A1:G${maxRow}`;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
