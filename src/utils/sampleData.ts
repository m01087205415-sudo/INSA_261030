import { Candidate, InterviewRecord, ReportBatch } from '../types';
import { getSeoulToday, recalculateCandidateCareer, calculateKoreanAge, formatSalaryDisplay } from './careerCalc';

export function createVirtualSampleData(): {
  batch: ReportBatch;
  candidates: Candidate[];
  records: InterviewRecord[];
} {
  const today = getSeoulToday(); // 2026-10-30

  // 1. 홍길동 (근무중 2024-12-16 ~ 2026-10-30 = 1년 10개월, 전문학사 3년제 -1년 감산)
  const candidate1: Candidate = {
    id: 'cand_demo_01',
    nameKo: '홍길동',
    birthDate: '1990-05-15',
    calculatedAge: 36,
    birthYearDisplay: '90년\n(만36세)',
    education: [
      {
        schoolName: '인덕대학교',
        major: '건축과',
        degreeType: '전문학사(3년제)',
        graduationDate: '2013-02-15',
        pageNumber: 1,
      },
      {
        schoolName: '한양사이버대학교',
        major: '건축공학과',
        degreeType: '학사',
        graduationDate: '2019-02-20',
        pageNumber: 1,
      },
    ],
    educationDisplay: '한양사이버대학교\n건축공학과',
    addressCityCountyDistrict: '서울\n성북구',
    addressRaw: '서울특별시 성북구 삼선교로 14길',
    qualifications: [
      { name: '건축기사', issueDate: '2015-06-12', pageNumber: 1 },
      { name: '건설안전기사', issueDate: '2017-11-20', pageNumber: 1 },
    ],
    qualificationsDisplay: '건축기사\n건설안전기사',
    resumeContact: '010-3849-1928',
    createdAt: new Date().toISOString(),
  };

  const c1Periods = [
    {
      id: 'p1_1',
      companyRaw: '(주)삼우씨엠건축사사무소',
      startDate: '2024-12-16',
      endDate: '근무중',
      isCurrentlyEmployed: true,
      position: '차장',
      months: 22, // 1년 10개월
      durationDisplay: '1년 10개월',
      order: 1,
    },
    {
      id: 'p1_2',
      companyRaw: '대우건설(주)',
      startDate: '2020-03-01',
      endDate: '2024-05-31',
      isCurrentlyEmployed: false,
      position: '과장',
      months: 50, // 4년 2개월
      durationDisplay: '4년 2개월',
      order: 2,
    },
  ];

  const c1Calc = recalculateCandidateCareer(c1Periods, candidate1.education, today);

  const record1: InterviewRecord = {
    id: 'rec_demo_01',
    candidateId: candidate1.id,
    candidateName: candidate1.nameKo,
    reportBatchId: 'batch_demo_20261103',
    interviewDateTime: '2026-11-03T14:00:00',
    interviewDateTimeRaw: '11월 3일(화) 오후 2시',
    interviewDateParsed: '2026-11-03',
    interviewTimeParsed: '14:00',
    interviewDisplayString: '2026-11-03\n14:00',
    calendarDisplayTitle: '홍길동(본사_외주) - 2PM',
    scheduleStatus: 'confirmed',
    handwrittenJobType: '외주',
    handwrittenPlacement: '본사',
    handwrittenJobTypeStatus: 'present',
    handwrittenPlacementStatus: 'present',
    desiredSalaryRaw: '5,500',
    desiredSalaryDisplay: '5,500\n(직전 4,800)',
    previousSalaryManwon: 4800,
    employmentPeriods: c1Calc.periods,
    degreeDeductionMonths: c1Calc.degreeDeductionMonths,
    degreeDeductionLabel: c1Calc.degreeDeductionLabel,
    totalCareerMonths: c1Calc.netCareerMonths,
    totalCareerDisplay: c1Calc.totalCareerDisplay,
    expectedPositionAndSalary: '',
    issues: [],
    status: 'confirmed',
    evidence: [
      {
        documentId: 'doc_demo_cert1',
        fileName: '홍길동_경력증명서.pdf',
        pageNumber: 1,
        originalText: '근무처: (주)삼우씨엠건축사사무소 (2024.12.16 ~ 현재)',
        fieldPath: 'employmentPeriods[0]',
      },
      {
        documentId: 'doc_demo_resume1',
        fileName: '홍길동_이력서.pdf',
        pageNumber: 1,
        originalText: '수기메모: 본사(외주) 11/3(화) 14시',
        fieldPath: 'handwriting',
      },
    ],
    userEdits: [],
    confirmedAt: new Date().toISOString(),
    reportDateSnapshot: today,
    ruleVersion: '2026.10.30_v1',
  };

  // 2. 이수민 (2024-09-30 ~ 2024-12-06 = 0년 2개월, 일반 전문학사 -2년 감산)
  const candidate2: Candidate = {
    id: 'cand_demo_02',
    nameKo: '이수민',
    birthDate: '1987-11-20',
    calculatedAge: 38,
    birthYearDisplay: '87년\n(만38세)',
    education: [
      {
        schoolName: '인하공업전문대학',
        major: '토목환경과',
        degreeType: '전문학사',
        graduationDate: '2008-02-15',
        pageNumber: 1,
      },
    ],
    educationDisplay: '인하공업전문대학\n토목환경과',
    addressCityCountyDistrict: '경기\n안양시\n만안구',
    addressRaw: '경기도 안양시 만안구 안양로 112',
    qualifications: [{ name: '토목기사', issueDate: '2010-08-20', pageNumber: 1 }],
    qualificationsDisplay: '토목기사',
    resumeContact: '010-5928-1120',
    createdAt: new Date().toISOString(),
  };

  const c2Periods = [
    {
      id: 'p2_1',
      companyRaw: '(주)포스코이앤씨',
      startDate: '2024-09-30',
      endDate: '2024-12-06',
      isCurrentlyEmployed: false,
      position: '부장',
      months: 2, // 0년 2개월
      durationDisplay: '0년 2개월',
      order: 1,
    },
    {
      id: 'p2_2',
      companyRaw: '현대건설(주)',
      startDate: '2018-01-02',
      endDate: '2023-08-31',
      isCurrentlyEmployed: false,
      position: '차장',
      months: 67, // 5년 7개월
      durationDisplay: '5년 7개월',
      order: 2,
    },
  ];

  const c2Calc = recalculateCandidateCareer(c2Periods, candidate2.education, today);

  const record2: InterviewRecord = {
    id: 'rec_demo_02',
    candidateId: candidate2.id,
    candidateName: candidate2.nameKo,
    reportBatchId: 'batch_demo_20261103',
    interviewDateTime: '2026-11-04T14:30:00',
    interviewDateTimeRaw: '11월 4일(수) 오후 2시 30분',
    interviewDateParsed: '2026-11-04',
    interviewTimeParsed: '14:30',
    interviewDisplayString: '2026-11-04\n14:30',
    calendarDisplayTitle: '이수민(서울현장_토목) - 2:30PM',
    scheduleStatus: 'confirmed',
    handwrittenJobType: '토목',
    handwrittenPlacement: '서울현장',
    handwrittenJobTypeStatus: 'present',
    handwrittenPlacementStatus: 'present',
    desiredSalaryRaw: '회사내규에 따름',
    desiredSalaryDisplay: '회사내규에 따름\n(직전 5,500)',
    previousSalaryManwon: 5500,
    employmentPeriods: c2Calc.periods,
    degreeDeductionMonths: c2Calc.degreeDeductionMonths,
    degreeDeductionLabel: c2Calc.degreeDeductionLabel,
    totalCareerMonths: c2Calc.netCareerMonths,
    totalCareerDisplay: c2Calc.totalCareerDisplay,
    expectedPositionAndSalary: '',
    issues: [],
    status: 'confirmed',
    evidence: [],
    userEdits: [],
    confirmedAt: new Date().toISOString(),
    reportDateSnapshot: today,
    ruleVersion: '2026.10.30_v1',
  };

  // 3. 박정호 (전기, 배치현장 미기재 -> "(_전기)", 9AM)
  const candidate3: Candidate = {
    id: 'cand_demo_03',
    nameKo: '박정호',
    birthDate: '1992-03-08',
    calculatedAge: 34,
    birthYearDisplay: '92년\n(만34세)',
    education: [
      {
        schoolName: '숭실대학교',
        major: '전기공학과',
        degreeType: '학사',
        graduationDate: '2016-02-15',
        pageNumber: 1,
      },
    ],
    educationDisplay: '숭실대학교\n전기공학과',
    addressCityCountyDistrict: '인천\n연수구',
    addressRaw: '인천광역시 연수구 송도과학로 32',
    qualifications: [{ name: '전기기사', issueDate: '2015-11-01', pageNumber: 1 }],
    qualificationsDisplay: '전기기사',
    resumeContact: '010-8291-4402',
    createdAt: new Date().toISOString(),
  };

  const c3Periods = [
    {
      id: 'p3_1',
      companyRaw: '한화건설(주)',
      startDate: '2016-03-01',
      endDate: '2024-02-28',
      isCurrentlyEmployed: false,
      position: '과장',
      months: 95, // 7년 11개월
      durationDisplay: '7년 11개월',
      order: 1,
    },
  ];

  const c3Calc = recalculateCandidateCareer(c3Periods, candidate3.education, today);

  const record3: InterviewRecord = {
    id: 'rec_demo_03',
    candidateId: candidate3.id,
    candidateName: candidate3.nameKo,
    reportBatchId: 'batch_demo_20261103',
    interviewDateTime: '2026-11-04T09:00:00',
    interviewDateTimeRaw: '11월 4일 오전 9시',
    interviewDateParsed: '2026-11-04',
    interviewTimeParsed: '09:00',
    interviewDisplayString: '2026-11-04\n09:00',
    calendarDisplayTitle: '박정호(_전기) - 9AM',
    scheduleStatus: 'confirmed',
    handwrittenJobType: '전기',
    handwrittenPlacement: '',
    handwrittenJobTypeStatus: 'present',
    handwrittenPlacementStatus: 'empty',
    desiredSalaryRaw: '6,000',
    desiredSalaryDisplay: '6,000',
    previousSalaryManwon: null,
    employmentPeriods: c3Calc.periods,
    degreeDeductionMonths: c3Calc.degreeDeductionMonths,
    degreeDeductionLabel: c3Calc.degreeDeductionLabel,
    totalCareerMonths: c3Calc.netCareerMonths,
    totalCareerDisplay: c3Calc.totalCareerDisplay,
    expectedPositionAndSalary: '',
    issues: [
      {
        id: 'iss_3_1',
        fieldPath: 'handwrittenPlacement',
        severity: 'info',
        message: '배치현장 수기 메모 미기재로 공란 처리되었습니다.',
        needsReview: false,
      },
    ],
    status: 'confirmed',
    evidence: [],
    userEdits: [],
    confirmedAt: new Date().toISOString(),
    reportDateSnapshot: today,
    ruleVersion: '2026.10.30_v1',
  };

  // 4. 김태영 (일정 미정 -> 종합 관리표 최하단 정렬 검증)
  const candidate4: Candidate = {
    id: 'cand_demo_04',
    nameKo: '김태영',
    birthDate: '1985-08-10',
    calculatedAge: 41,
    birthYearDisplay: '85년\n(만41세)',
    education: [
      {
        schoolName: '중앙대학교',
        major: '건축공학과',
        degreeType: '학사',
        graduationDate: '2010-02-15',
        pageNumber: 1,
      },
    ],
    educationDisplay: '중앙대학교\n건축공학과',
    addressCityCountyDistrict: '서울\n강남구',
    addressRaw: '서울특별시 강남구 테헤란로 201',
    qualifications: [{ name: '건축시공기술사', issueDate: '2021-04-10', pageNumber: 1 }],
    qualificationsDisplay: '건축시공기술사',
    resumeContact: '010-9981-1204',
    createdAt: new Date().toISOString(),
  };

  const c4Periods = [
    {
      id: 'p4_1',
      companyRaw: 'GS건설(주)',
      startDate: '2010-03-01',
      endDate: '2025-06-30',
      isCurrentlyEmployed: false,
      position: '부장',
      months: 183, // 15년 3개월
      durationDisplay: '15년 3개월',
      order: 1,
    },
  ];

  const c4Calc = recalculateCandidateCareer(c4Periods, candidate4.education, today);

  const record4: InterviewRecord = {
    id: 'rec_demo_04',
    candidateId: candidate4.id,
    candidateName: candidate4.nameKo,
    reportBatchId: 'batch_demo_20261103',
    interviewDateTime: null, // 일정 미정
    interviewDateTimeRaw: '일정 조율 중',
    interviewDateParsed: null,
    interviewTimeParsed: null,
    interviewDisplayString: '일정 미정',
    calendarDisplayTitle: '김태영(_) - 일정미정',
    scheduleStatus: 'unscheduled',
    handwrittenJobType: '',
    handwrittenPlacement: '',
    handwrittenJobTypeStatus: 'empty',
    handwrittenPlacementStatus: 'empty',
    desiredSalaryRaw: '',
    desiredSalaryDisplay: '(직전 8,500)',
    previousSalaryManwon: 8500,
    employmentPeriods: c4Calc.periods,
    degreeDeductionMonths: c4Calc.degreeDeductionMonths,
    degreeDeductionLabel: c4Calc.degreeDeductionLabel,
    totalCareerMonths: c4Calc.netCareerMonths,
    totalCareerDisplay: c4Calc.totalCareerDisplay,
    expectedPositionAndSalary: '',
    issues: [
      {
        id: 'iss_4_1',
        fieldPath: 'interviewDateTime',
        severity: 'warning',
        message: '면접일정이 확정되지 않았습니다. 종합표 최하단에 배치됩니다.',
        needsReview: true,
      },
    ],
    status: 'confirmed',
    evidence: [],
    userEdits: [],
    confirmedAt: new Date().toISOString(),
    reportDateSnapshot: today,
    ruleVersion: '2026.10.30_v1',
  };

  const batch: ReportBatch = {
    id: 'batch_demo_20261103',
    sheetName: '2026-11-03_면접',
    reportDate: today,
    recordIds: [record1.id, record2.id, record3.id, record4.id],
    createdAt: new Date().toISOString(),
    status: 'active',
    ruleVersion: '2026.10.30_v1',
  };

  return {
    batch,
    candidates: [candidate1, candidate2, candidate3, candidate4],
    records: [record1, record2, record3, record4],
  };
}
