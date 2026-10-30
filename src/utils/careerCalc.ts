import { EmploymentPeriod, EducationEntry } from '../types';

/**
 * Returns today's date in Asia/Seoul (KST, UTC+9) as YYYY-MM-DD
 */
export function getSeoulToday(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // e.g. 2026-10-30
}

/**
 * Deterministic Excel DATEDIF(startDate, endDate, "m") implementation.
 * Counts completed whole calendar months.
 * Does not add arbitrary +1 day to end date. Residual days are discarded.
 */
export function excelDatedifMonths(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;

  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);

  if (isNaN(sy) || isNaN(sm) || isNaN(sd) || isNaN(ey) || isNaN(em) || isNaN(ed)) {
    return 0;
  }

  // Calculate year and month difference
  let months = (ey - sy) * 12 + (em - sm);

  // If end day is strictly less than start day, full month is not completed
  if (ed < sd) {
    months -= 1;
  }

  return Math.max(0, months);
}

/**
 * Formats months into "X년 Y개월"
 */
export function formatYearsMonths(months: number): string {
  if (months <= 0) return '0년 0개월';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `${years}년 ${rem}개월`;
}

/**
 * Calculates Korean legal age (만나이) and display string
 * Example: 1990-05-15, reportDate 2026-10-30 -> "90년\n(만36세)"
 */
export function calculateKoreanAge(
  birthDateStr: string,
  reportDateStr: string = getSeoulToday()
): { age: number | null; display: string; needsReview: boolean } {
  if (!birthDateStr || birthDateStr.length < 10) {
    return { age: null, display: '생년월일\n(확인 필요)', needsReview: true };
  }

  const [by, bm, bd] = birthDateStr.split('-').map(Number);
  const [ry, rm, rd] = reportDateStr.split('-').map(Number);

  if (isNaN(by) || isNaN(bm) || isNaN(bd) || isNaN(ry) || isNaN(rm) || isNaN(rd)) {
    return { age: null, display: '생년월일\n(확인 필요)', needsReview: true };
  }

  let age = ry - by;
  // If birthday has not occurred yet this year, subtract 1
  if (rm < bm || (rm === bm && rd < bd)) {
    age -= 1;
  }

  const yearSuffix = String(by).slice(-2);
  return {
    age,
    display: `${yearSuffix}년\n(만${age}세)`,
    needsReview: false,
  };
}

/**
 * Determines associate degree deduction months (0, 12, or 24)
 * - "전문학사(3년제)" -> 12개월 감산
 * - "전문학사" -> 24개월 감산
 * - Deduction applies at most once even with multiple degrees.
 */
export function calculateDegreeDeduction(education: EducationEntry[]): {
  deductionMonths: number;
  label: string;
} {
  let hasThreeYearAssociate = false;
  let hasRegularAssociate = false;

  for (const edu of education) {
    const raw = `${edu.degreeType || ''} ${edu.schoolName} ${edu.major}`.toLowerCase();
    if (raw.includes('전문학사(3년제)') || raw.includes('3년제') || raw.includes('전문대(3년)')) {
      hasThreeYearAssociate = true;
    } else if (raw.includes('전문학사') || raw.includes('전문대') || raw.includes('전문대학')) {
      hasRegularAssociate = true;
    }
  }

  if (hasThreeYearAssociate) {
    return {
      deductionMonths: 12,
      label: '전문학사 감산 / -1년',
    };
  }

  if (hasRegularAssociate) {
    return {
      deductionMonths: 24,
      label: '전문학사 감산 / -2년',
    };
  }

  return {
    deductionMonths: 0,
    label: '',
  };
}

/**
 * Calculates complete career summary for a candidate given a report date
 */
export function recalculateCandidateCareer(
  periods: EmploymentPeriod[],
  education: EducationEntry[],
  reportDateStr: string = getSeoulToday()
) {
  // Sort periods in descending order by start date (recent first)
  const sortedPeriods = [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate));

  let totalMonths = 0;
  const recalculatedPeriods: EmploymentPeriod[] = sortedPeriods.map((period, idx) => {
    const isCurrentlyEmployed =
      period.isCurrentlyEmployed || period.endDate === '근무중' || !period.endDate;
    const effectiveEndDate = isCurrentlyEmployed ? reportDateStr : period.endDate;
    const months = excelDatedifMonths(period.startDate, effectiveEndDate);

    totalMonths += months;

    return {
      ...period,
      order: idx + 1,
      isCurrentlyEmployed,
      endDate: isCurrentlyEmployed ? '근무중' : period.endDate,
      months,
      durationDisplay: formatYearsMonths(months),
    };
  });

  const { deductionMonths, label: degreeDeductionLabel } = calculateDegreeDeduction(education);
  const netCareerMonths = totalMonths - deductionMonths;

  return {
    periods: recalculatedPeriods,
    grossCareerMonths: totalMonths,
    degreeDeductionMonths: deductionMonths,
    degreeDeductionLabel,
    netCareerMonths,
    totalCareerDisplay: formatYearsMonths(Math.max(0, netCareerMonths)),
    isNegative: netCareerMonths < 0,
  };
}

/**
 * Format address to City / County / District line breaks
 * e.g. "서울 성북구" -> "서울\n성북구", "경기 안양시 만안구" -> "경기\n안양시\n만안구"
 */
export function formatAddressDisplay(addressStr: string): string {
  if (!addressStr) return '';
  const parts = addressStr.trim().split(/\s+/);
  if (parts.length <= 1) return addressStr;
  return parts.join('\n');
}

/**
 * Format education display: School name and major with line break
 */
export function formatEducationDisplay(education: EducationEntry[]): string {
  if (!education || education.length === 0) return '';
  const lastEdu = education[education.length - 1]; // Latest
  if (!lastEdu.major) return lastEdu.schoolName;
  return `${lastEdu.schoolName}\n${lastEdu.major}`;
}

/**
 * Format qualifications display (National technical certifications only)
 */
export function formatQualificationsDisplay(qualifications: { name: string }[]): string {
  if (!qualifications || qualifications.length === 0) return '';
  return qualifications.map((q) => q.name).join('\n');
}

/**
 * Format salary display with optional previous salary
 */
export function formatSalaryDisplay(
  desiredSalaryRaw: string,
  previousSalaryManwon: number | null
): string {
  const desired = (desiredSalaryRaw || '').trim();
  const prev =
    previousSalaryManwon && !isNaN(previousSalaryManwon)
      ? `(직전 ${previousSalaryManwon.toLocaleString()})`
      : '';

  if (desired && prev) {
    return `${desired}\n${prev}`;
  }
  if (prev) {
    return prev;
  }
  return desired;
}
