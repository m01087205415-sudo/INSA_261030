/**
 * 대한민국 관공서의 공휴일에 관한 규정 및 공직선거법에 따른
 * 공휴일·대체공휴일·선거일 데이터 및 판정 유틸리티
 * 한국 공공데이터포털(특일정보 API) 및 date-holidays 라이브러리 연동 지원
 */

// Dynamic cache populated from /api/holidays or local computation
const DYNAMIC_HOLIDAYS_CACHE: Record<string, string> = {};

// Key: YYYY-MM-DD, Value: Holiday Name
const KOREAN_HOLIDAYS_MAP: Record<string, string> = {
  // === 2024년 ===
  '2024-01-01': '신정',
  '2024-02-09': '설날 연휴',
  '2024-02-10': '설날',
  '2024-02-11': '설날 연휴',
  '2024-02-12': '대체공휴일(설날)',
  '2024-03-01': '삼일절',
  '2024-04-10': '제22대 국회의원선거일',
  '2024-05-05': '어린이날',
  '2024-05-06': '대체공휴일(어린이날)',
  '2024-05-15': '부처님오신날',
  '2024-06-06': '현충일',
  '2024-08-15': '광복절',
  '2024-09-16': '추석 연휴',
  '2024-09-17': '추석',
  '2024-09-18': '추석 연휴',
  '2024-10-01': '임시공휴일(국군의날)',
  '2024-10-03': '개천절',
  '2024-10-09': '한글날',
  '2024-12-25': '성탄절',

  // === 2025년 ===
  '2025-01-01': '신정',
  '2025-01-27': '임시공휴일',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '삼일절',
  '2025-03-03': '대체공휴일(삼일절)',
  '2025-05-05': '어린이날',
  '2025-05-06': '대체공휴일(어린이날·부처님오신날)',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴',
  '2025-10-06': '추석',
  '2025-10-07': '추석 연휴',
  '2025-10-08': '대체공휴일(추석)',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절',

  // === 2026년 ===
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '대체공휴일(삼일절)',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일(부처님오신날)',
  '2026-06-03': '제9회 전국동시지방선거일',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일(광복절)',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-05': '대체공휴일(개천절)',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',

  // === 2027년 ===
  '2027-01-01': '신정',
  '2027-02-06': '설날 연휴',
  '2027-02-07': '설날',
  '2027-02-08': '설날 연휴',
  '2027-02-09': '대체공휴일(설날)',
  '2027-03-01': '삼일절',
  '2027-03-03': '제21대 대통령선거일',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-08-15': '광복절',
  '2027-08-16': '대체공휴일(광복절)',
  '2027-09-14': '추석 연휴',
  '2027-09-15': '추석',
  '2027-09-16': '추석 연휴',
  '2027-10-03': '개천절',
  '2027-10-04': '대체공휴일(개천절)',
  '2027-10-09': '한글날',
  '2027-10-11': '대체공휴일(한글날)',
  '2027-12-25': '성탄절',
  '2027-12-27': '대체공휴일(성탄절)',

  // === 2028년 ===
  '2028-01-01': '신정',
  '2028-01-26': '설날 연휴',
  '2028-01-27': '설날',
  '2028-01-28': '설날 연휴',
  '2028-03-01': '삼일절',
  '2028-04-12': '제23대 국회의원선거일',
  '2028-05-02': '부처님오신날',
  '2028-05-05': '어린이날',
  '2028-06-06': '현충일',
  '2028-08-15': '광복절',
  '2028-10-02': '추석 연휴',
  '2028-10-03': '추석·개천절',
  '2028-10-04': '추석 연휴',
  '2028-10-05': '대체공휴일(추석)',
  '2028-10-09': '한글날',
  '2028-12-25': '성탄절',
};

// Fixed annual solar holidays check (fallback for any future years)
const FIXED_ANNUAL_HOLIDAYS: Record<string, string> = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '성탄절',
};

/**
 * Asynchronously preloads public holidays from the server API (which queries
 * Korean public data portal or date-holidays computation engine)
 */
export async function preloadPublicHolidays(year: number): Promise<void> {
  try {
    const res = await fetch(`/api/holidays?year=${year}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.holidays) {
        for (const [dateStr, name] of Object.entries(json.holidays)) {
          DYNAMIC_HOLIDAYS_CACHE[dateStr] = name as string;
        }
      }
    }
  } catch (e) {
    // Graceful fallback to local calculation
  }
}

/**
 * Returns Korean public holiday information for a given YYYY-MM-DD
 */
export function getKoreanHoliday(dateStr: string): { isHoliday: boolean; name: string } | null {
  if (!dateStr || dateStr.length < 10) return null;

  // 1. Check dynamic cache (from public data portal API / calculation engine)
  if (DYNAMIC_HOLIDAYS_CACHE[dateStr]) {
    return {
      isHoliday: true,
      name: DYNAMIC_HOLIDAYS_CACHE[dateStr],
    };
  }

  // 2. Check exact statutory map
  if (KOREAN_HOLIDAYS_MAP[dateStr]) {
    return {
      isHoliday: true,
      name: KOREAN_HOLIDAYS_MAP[dateStr],
    };
  }

  // 3. Fallback check for fixed solar holidays for unmapped years
  const mmdd = dateStr.slice(5, 10);
  if (FIXED_ANNUAL_HOLIDAYS[mmdd]) {
    return {
      isHoliday: true,
      name: FIXED_ANNUAL_HOLIDAYS[mmdd],
    };
  }

  return null;
}
