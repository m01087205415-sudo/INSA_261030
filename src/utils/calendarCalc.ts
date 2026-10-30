import { InterviewRecord, CalendarMonthSheet } from '../types';
import { getKoreanHoliday } from './holidays';

/**
 * Format time string into standard KOCEA interview schedule notation:
 * 14:00 -> 2PM
 * 14:30 -> 2:30PM
 * 09:00 -> 9AM
 * 12:00 -> 12PM
 * 00:00 -> 12AM
 */
export function formatInterviewTime(timeStr: string): string {
  if (!timeStr) return '';
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeStr;

  const hours = parseInt(match[1], 10);
  const minutes = match[2];

  const period = hours >= 12 ? 'PM' : 'AM';
  let displayHour = hours % 12;
  if (displayHour === 0) displayHour = 12;

  if (minutes === '00') {
    return `${displayHour}${period}`;
  }
  return `${displayHour}:${minutes}${period}`;
}

/**
 * Builds standard schedule string: `성명(배치현장_직종) - 시간`
 * Examples:
 * - 홍길동(서울현장_건축) - 2PM
 * - 홍길동(_건축) - 2PM
 * - 홍길동(서울현장_) - 2PM
 * - 홍길동(_) - 2PM
 */
export function buildScheduleDisplayText(
  name: string,
  placement: string | undefined,
  jobType: string | undefined,
  timeFormatted: string
): string {
  const p = (placement || '').trim();
  const j = (jobType || '').trim();
  const base = `${name.trim()}(${p}_${j})`;
  if (!timeFormatted) return base;
  return `${base} - ${timeFormatted}`;
}

/**
 * Estimates optimal font size (in pt) so the string fits into a 15.78 Excel column width.
 * Standard Excel font is Malgun Gothic (맑은 고딕).
 */
export function estimateScheduleFontSize(text: string): number {
  const len = text.length;
  if (len <= 12) return 9;
  if (len <= 16) return 8;
  if (len <= 21) return 7;
  return 6.5;
}

/**
 * Returns rolling 12 months array in descending order starting from basisMonth.
 * Example: for '2026-11' -> ['2026-11', '2026-10', ..., '2025-12']
 */
export function getRolling12Months(basisMonth: string): string[] {
  const [yearStr, monthStr] = basisMonth.split('-');
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10);

  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const formatted = `${y}-${String(m).padStart(2, '0')}`;
    months.push(formatted);

    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return months;
}

/**
 * Calculates calendar grid data for a given yearMonth (YYYY-MM).
 * Returns weeks array with day number and interview slots (up to 4 items).
 */
export interface CalendarCell {
  dayNumber: number | null; // null if outside month
  dateStr: string | null; // YYYY-MM-DD
  isSunday: boolean;
  isSaturday: boolean;
  isHoliday: boolean; // 공휴일·대체공휴일·선거일 여부
  holidayName?: string; // 공휴일 명칭
  slots: Array<{
    recordId: string;
    text: string;
    fontSizePt: number;
    timeRaw: string;
  }>;
  hasOverflow: boolean;
  overflowCount: number;
}

export interface CalendarWeek {
  weekIndex: number;
  dateRowNumber: number; // 4, 9, 14, 19, 24, 29
  contentRowStart: number; // 5, 10, 15, 20, 25, 30
  days: CalendarCell[]; // 7 days (Sun=0 to Sat=6)
}

export function generateMonthCalendarGrid(
  yearMonth: string,
  records: InterviewRecord[]
): {
  yearMonth: string;
  yearMonthKorean: string;
  totalWeeks: number;
  weeks: CalendarWeek[];
  totalInterviews: number;
  overflowTotal: number;
} {
  const [yStr, mStr] = yearMonth.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);

  // Month stats
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 is Sun
  const totalDays = new Date(year, month, 0).getDate();

  // Group records by YYYY-MM-DD
  const recordsByDate: Record<string, InterviewRecord[]> = {};
  let totalInterviews = 0;

  for (const rec of records) {
    if (rec.status === 'cancelled') continue;
    let date = rec.interviewDateParsed;
    if (!date && rec.interviewDateTime) {
      date = rec.interviewDateTime.slice(0, 10);
    }
    if (date && date.startsWith(yearMonth)) {
      if (!recordsByDate[date]) {
        recordsByDate[date] = [];
      }
      recordsByDate[date].push(rec);
      totalInterviews++;
    }
  }

  // Sort records on same day by time
  for (const date in recordsByDate) {
    recordsByDate[date].sort((a, b) => {
      const timeA = a.interviewTimeParsed || '99:99';
      const timeB = b.interviewTimeParsed || '99:99';
      return timeA.localeCompare(timeB);
    });
  }

  const weeks: CalendarWeek[] = [];
  let currentDay = 1;
  let weekIndex = 0;
  let overflowTotal = 0;

  while (currentDay <= totalDays) {
    const dateRowNumber = 4 + weekIndex * 5;
    const contentRowStart = dateRowNumber + 1;
    const days: CalendarCell[] = [];

    for (let col = 0; col < 7; col++) {
      if ((weekIndex === 0 && col < firstDayOfWeek) || currentDay > totalDays) {
        // Empty cell outside current month
        days.push({
          dayNumber: null,
          dateStr: null,
          isSunday: col === 0,
          isSaturday: col === 6,
          isHoliday: false,
          slots: [],
          hasOverflow: false,
          overflowCount: 0,
        });
      } else {
        const dateStr = `${yearMonth}-${String(currentDay).padStart(2, '0')}`;
        const holidayInfo = getKoreanHoliday(dateStr);
        const dayRecords = recordsByDate[dateStr] || [];

        const slots = dayRecords.slice(0, 4).map((rec) => {
          const timeFormatted = formatInterviewTime(rec.interviewTimeParsed || '');
          const placement = rec.placementOverride || rec.handwrittenPlacement || '';
          const jobType = rec.jobTypeOverride || rec.handwrittenJobType || '';
          const text = buildScheduleDisplayText(
            rec.candidateName,
            placement,
            jobType,
            timeFormatted
          );
          const fontSizePt = estimateScheduleFontSize(text);
          return {
            recordId: rec.id,
            text,
            fontSizePt,
            timeRaw: rec.interviewTimeParsed || '',
          };
        });

        const overflowCount = Math.max(0, dayRecords.length - 4);
        if (overflowCount > 0) {
          overflowTotal += overflowCount;
        }

        days.push({
          dayNumber: currentDay,
          dateStr,
          isSunday: col === 0,
          isSaturday: col === 6,
          isHoliday: Boolean(holidayInfo?.isHoliday),
          holidayName: holidayInfo?.name,
          slots,
          hasOverflow: overflowCount > 0,
          overflowCount,
        });

        currentDay++;
      }
    }

    weeks.push({
      weekIndex,
      dateRowNumber,
      contentRowStart,
      days,
    });
    weekIndex++;
  }

  return {
    yearMonth,
    yearMonthKorean: `${year}년 ${month}월`,
    totalWeeks: weeks.length,
    weeks,
    totalInterviews,
    overflowTotal,
  };
}
