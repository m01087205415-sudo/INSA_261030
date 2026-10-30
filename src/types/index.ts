export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  fieldPath: string;
  severity: ValidationSeverity;
  message: string;
  pageNumber?: number;
  needsReview: boolean;
}

export interface Evidence {
  documentId: string;
  fileName: string;
  pageNumber: number;
  originalText: string;
  location?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  fieldPath: string;
}

export interface UserEditLog {
  timestamp: string;
  field: string;
  oldValue: any;
  newValue: any;
}

export interface EducationEntry {
  schoolName: string;
  major: string;
  degreeType?: string; // '고졸' | '전문학사' | '전문학사(3년제)' | '학사' | '석사' | '박사'
  graduationDate?: string;
  pageNumber?: number;
}

export interface QualificationEntry {
  name: string; // 국가기술자격 종목 및 등급 (e.g. 건축기사, 토목기사)
  issueDate?: string;
  pageNumber?: number;
}

export interface EmploymentPeriod {
  id: string;
  companyRaw: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD or "근무중"
  isCurrentlyEmployed: boolean;
  position: string; // 퇴직일(또는 현재) 기준 직위, or "미기재"
  months: number; // Excel DATEDIF(startDate, endDate, "m")
  durationDisplay: string; // e.g. "1년 10개월"
  positionEvidence?: string;
  pageNumber?: number;
  order: number;
}

export interface Candidate {
  id: string;
  nameKo: string;
  birthDate: string; // YYYY-MM-DD
  birthDateRaw?: string;
  calculatedAge?: number;
  birthYearDisplay?: string; // e.g. "90년\n(만36세)"
  education: EducationEntry[];
  educationDisplay?: string;
  addressCityCountyDistrict: string; // e.g. "서울\n성북구"
  addressRaw?: string;
  qualifications: QualificationEntry[];
  qualificationsDisplay?: string;
  resumeContact: string; // 010... 문자열
  createdAt: string;
}

export type ScheduleStatus = 'confirmed' | 'needs_review' | 'unscheduled' | 'user_edited';

export interface InterviewRecord {
  id: string;
  candidateId: string;
  candidateName: string;
  reportBatchId?: string;
  
  // 면접 일정
  interviewDateTime: string | null; // ISO string for sorting (e.g. 2026-11-03T14:00:00)
  interviewDateTimeRaw: string; // e.g. "11월 3일(화) 오후 2시"
  interviewDateParsed: string | null; // YYYY-MM-DD
  interviewTimeParsed: string | null; // HH:mm (e.g. 14:00)
  interviewDisplayString: string; // For table display
  calendarDisplayTitle: string; // e.g. "홍길동(본사_외주) - 2PM"
  scheduleStatus: ScheduleStatus;
  
  // 수기 메모 (인사담당자 펜 수기)
  handwrittenJobType: string; // e.g. "외주"
  handwrittenPlacement: string; // e.g. "본사"
  handwrittenJobTypeStatus: 'present' | 'empty' | 'unreadable' | 'user_edited';
  handwrittenPlacementStatus: 'present' | 'empty' | 'unreadable' | 'user_edited';
  jobTypeOverride?: string;
  placementOverride?: string;
  handwritingNotes?: string;
  
  // 연봉
  desiredSalaryRaw: string; // e.g. "5,000~6,000" or "회사내규에 따름"
  desiredSalaryDisplay: string; // e.g. "5,000~6,000\n(직전 4,500)"
  previousSalaryManwon: number | null; // e.g. 4500
  
  // 경력
  employmentPeriods: EmploymentPeriod[];
  degreeDeductionMonths: number; // 0, 12, or 24
  degreeDeductionLabel: string; // "전문학사 감산 / -1년" or "전문학사 감산 / -2년"
  totalCareerMonths: number;
  totalCareerDisplay: string; // e.g. "5년 3개월"
  
  // 예정직급(연봉) - 항상 공란
  expectedPositionAndSalary: string;
  
  // 검토 및 상태
  issues: ValidationIssue[];
  status: 'draft' | 'confirmed' | 'cancelled';
  evidence: Evidence[];
  userEdits: UserEditLog[];
  confirmedAt: string | null;
  reportDateSnapshot: string; // Asia/Seoul date snapshot (e.g. 2026-10-30)
  ruleVersion: string;
}

export interface ReportBatch {
  id: string;
  sheetName: string; // e.g. "2026-11-03_면접"
  reportDate: string; // Asia/Seoul YYYY-MM-DD
  recordIds: string[];
  createdAt: string;
  status: 'active' | 'archived';
  ruleVersion: string;
}

export type TemplateRole = 'base' | 'border_sample' | 'calendar';

export interface TemplateProfile {
  id: string;
  role: TemplateRole;
  fileName: string;
  uploadedAt: string;
  fileSizeBytes: number;
  sourceSheetName: string;
  originalBytesBase64?: string;
  widths?: Record<string, number>;
  rowHeights?: Record<number, number>;
  merges?: string[];
  hiddenColumns?: string[];
  printSettings?: {
    orientation?: 'landscape' | 'portrait';
    fitToWidth?: number;
    fitToHeight?: number;
    margins?: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    };
    horizontalCentered?: boolean;
    paperSize?: number;
  };
}

export interface StoredDocument {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  candidateId?: string;
  base64Data: string;
  docType: 'resume' | 'career_cert' | 'other';
}

export interface CalendarMonthSheet {
  yearMonth: string; // YYYY-MM
  records: Array<{
    recordId: string;
    candidateName: string;
    interviewDate: string; // YYYY-MM-DD
    interviewTime: string; // HH:mm
    formattedText: string; // 성명(배치현장_직종) - 시간
    fontSizePt: number;
    isOverflown: boolean;
    slotIndex: number; // 0 to 3 for content rows
  }>;
  overflowCount: number;
  updatedAt: string;
}

export interface CalendarSettings {
  basisMonth: string; // YYYY-MM
  basisMode: 'auto' | 'manual';
  rollingMonthCount: number; // 12
  timezone: string; // 'Asia/Seoul'
}
