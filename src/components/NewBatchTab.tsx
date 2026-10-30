import React, { useState } from 'react';
import {
  Plus,
  Upload,
  Sparkles,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle,
  Eye,
  Trash2,
  Calendar,
  Layers,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { Candidate, InterviewRecord, ReportBatch, StoredDocument, TemplateProfile } from '../types';
import { getSeoulToday, recalculateCandidateCareer, calculateKoreanAge } from '../utils/careerCalc';
import { createVirtualSampleData } from '../utils/sampleData';
import { DocumentReviewModal } from './DocumentReviewModal';

interface NewBatchTabProps {
  currentBatch: ReportBatch;
  onUpdateBatch: (batch: ReportBatch) => void;
  draftCandidates: Candidate[];
  draftRecords: InterviewRecord[];
  draftDocuments: StoredDocument[];
  onUpdateDrafts: (candidates: Candidate[], records: InterviewRecord[], docs: StoredDocument[]) => void;
  onFinalizeBatch: () => void;
  onDownloadExcel: () => void;
  activeTemplate?: TemplateProfile;
}

export const NewBatchTab: React.FC<NewBatchTabProps> = ({
  currentBatch,
  onUpdateBatch,
  draftCandidates,
  draftRecords,
  draftDocuments,
  onUpdateDrafts,
  onFinalizeBatch,
  onDownloadExcel,
  activeTemplate,
}) => {
  const [selectedReviewCandidateId, setSelectedReviewCandidateId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCandidateName, setUploadCandidateName] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Changing report date immediately triggers recalculation of current draft records
  const handleDateChange = (newDate: string) => {
    const updatedBatch = {
      ...currentBatch,
      reportDate: newDate,
      sheetName: `${newDate}_면접`,
    };
    onUpdateBatch(updatedBatch);

    // Recalculate all draft candidate records
    const updatedRecords = draftRecords.map((rec) => {
      const cand = draftCandidates.find((c) => c.id === rec.candidateId);
      if (!cand) return rec;

      const calc = recalculateCandidateCareer(rec.employmentPeriods, cand.education, newDate);
      return {
        ...rec,
        reportDateSnapshot: newDate,
        employmentPeriods: calc.periods,
        degreeDeductionMonths: calc.degreeDeductionMonths,
        degreeDeductionLabel: calc.degreeDeductionLabel,
        totalCareerMonths: calc.netCareerMonths,
        totalCareerDisplay: calc.totalCareerDisplay,
      };
    });

    const updatedCandidates = draftCandidates.map((cand) => {
      const { age, display } = calculateKoreanAge(cand.birthDate, newDate);
      return {
        ...cand,
        calculatedAge: age || undefined,
        birthYearDisplay: display,
      };
    });

    onUpdateDrafts(updatedCandidates, updatedRecords, draftDocuments);
  };

  // Load virtual sample data
  const handleLoadSampleData = () => {
    const samples = createVirtualSampleData();
    onUpdateBatch({
      ...currentBatch,
      sheetName: samples.batch.sheetName,
      reportDate: samples.batch.reportDate,
      recordIds: samples.records.map((r) => r.id),
    });
    onUpdateDrafts(samples.candidates, samples.records, []);
  };

  // Handle file drop/selection in upload modal
  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPendingFiles(Array.from(e.target.files));
    }
  };

  // Execute server analysis via Gemini
  const handleAnalyzeFiles = async () => {
    if (pendingFiles.length === 0) {
      setUploadError('분석할 파일(PDF 또는 이미지)을 1개 이상 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Convert files to base64
      const filePayloads = await Promise.all(
        pendingFiles.map(async (file) => {
          const buffer = await file.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          const isCert =
            file.name.includes('경력증명서') ||
            file.name.includes('협회') ||
            file.name.includes('기술인');
          return {
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            base64,
            docType: isCert ? 'career_cert' : 'resume',
          };
        })
      );

      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: filePayloads,
          reportDate: currentBatch.reportDate,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gemini 서버 분석에 실패했습니다.');
      }

      const parsed = json.data;

      // Create new candidate & record
      const candId = `cand_${Date.now()}`;
      const recId = `rec_${Date.now()}`;

      const { age, display: birthDisplay } = calculateKoreanAge(
        parsed.birthDate,
        currentBatch.reportDate
      );

      const newCand: Candidate = {
        id: candId,
        nameKo: parsed.nameKo || uploadCandidateName || '신규 지원자',
        birthDate: parsed.birthDate || '',
        calculatedAge: age || undefined,
        birthYearDisplay: birthDisplay,
        education: parsed.education || [],
        addressCityCountyDistrict: parsed.addressCityCountyDistrict || '',
        qualifications: parsed.qualifications || [],
        resumeContact: parsed.resumeContact || '',
        createdAt: new Date().toISOString(),
      };

      const periods = (parsed.careerPeriods || []).map((cp: any, idx: number) => ({
        id: `period_${Date.now()}_${idx}`,
        companyRaw: cp.companyRaw || '',
        startDate: cp.startDate || '',
        endDate: cp.endDate || (cp.isCurrentlyEmployed ? '근무중' : ''),
        isCurrentlyEmployed: Boolean(cp.isCurrentlyEmployed || cp.endDate === '근무중'),
        position: cp.position || '미기재',
        months: 0,
        durationDisplay: '',
        order: idx + 1,
      }));

      const careerCalc = recalculateCandidateCareer(
        periods,
        newCand.education,
        currentBatch.reportDate
      );

      const interviewScheduleRaw = parsed.handwrittenInterviewSchedule?.rawText || '';
      const interviewDate = parsed.handwrittenInterviewSchedule?.parsedDate || null;
      const interviewTime = parsed.handwrittenInterviewSchedule?.parsedTime || null;

      const newRecord: InterviewRecord = {
        id: recId,
        candidateId: candId,
        candidateName: newCand.nameKo,
        reportBatchId: currentBatch.id,
        interviewDateTime: interviewDate ? `${interviewDate}T${interviewTime || '14:00'}:00` : null,
        interviewDateTimeRaw: interviewScheduleRaw,
        interviewDateParsed: interviewDate,
        interviewTimeParsed: interviewTime,
        interviewDisplayString: interviewDate
          ? `${interviewDate}\n${interviewTime || ''}`
          : interviewScheduleRaw || '일정 미정',
        calendarDisplayTitle: `${newCand.nameKo}(${parsed.handwrittenPlacement?.value || ''}_${
          parsed.handwrittenJobType?.value || ''
        })`,
        scheduleStatus: interviewDate ? 'confirmed' : 'needs_review',
        handwrittenJobType: parsed.handwrittenJobType?.value || '',
        handwrittenPlacement: parsed.handwrittenPlacement?.value || '',
        handwrittenJobTypeStatus: parsed.handwrittenJobType?.value ? 'present' : 'empty',
        handwrittenPlacementStatus: parsed.handwrittenPlacement?.value ? 'present' : 'empty',
        desiredSalaryRaw: parsed.desiredSalaryRaw || '',
        desiredSalaryDisplay: parsed.desiredSalaryRaw || '',
        previousSalaryManwon: parsed.previousSalaryManwon || null,
        employmentPeriods: careerCalc.periods,
        degreeDeductionMonths: careerCalc.degreeDeductionMonths,
        degreeDeductionLabel: careerCalc.degreeDeductionLabel,
        totalCareerMonths: careerCalc.netCareerMonths,
        totalCareerDisplay: careerCalc.totalCareerDisplay,
        expectedPositionAndSalary: '',
        issues: (parsed.issues || []).map((iss: any, i: number) => ({
          id: `iss_${Date.now()}_${i}`,
          fieldPath: iss.field || '',
          severity: iss.severity || 'warning',
          message: iss.message || '',
          pageNumber: iss.pageNumber,
          needsReview: Boolean(iss.needsReview),
        })),
        status: 'draft',
        evidence: [],
        userEdits: [],
        confirmedAt: null,
        reportDateSnapshot: currentBatch.reportDate,
        ruleVersion: '2026.10.30_v1',
      };

      // Store documents
      const newDocs: StoredDocument[] = filePayloads.map((f, i) => ({
        id: `doc_${Date.now()}_${i}`,
        fileName: f.fileName,
        mimeType: f.mimeType,
        size: pendingFiles[i]?.size || 0,
        uploadedAt: new Date().toISOString(),
        candidateId: candId,
        base64Data: f.base64,
        docType: f.docType as any,
      }));

      onUpdateDrafts(
        [...draftCandidates, newCand],
        [...draftRecords, newRecord],
        [...draftDocuments, ...newDocs]
      );

      setShowUploadModal(false);
      setPendingFiles([]);
      setUploadCandidateName('');
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || '파일 처리 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // Remove candidate
  const handleRemoveCandidate = (candId: string) => {
    const updatedCandidates = draftCandidates.filter((c) => c.id !== candId);
    const updatedRecords = draftRecords.filter((r) => r.candidateId !== candId);
    const updatedDocs = draftDocuments.filter((d) => d.candidateId !== candId);
    onUpdateDrafts(updatedCandidates, updatedRecords, updatedDocs);
  };

  // Review modal target
  const reviewTarget = draftCandidates.find((c) => c.id === selectedReviewCandidateId);
  const reviewRecord = draftRecords.find((r) => r.candidateId === selectedReviewCandidateId);
  const reviewDocs = draftDocuments.filter((d) => d.candidateId === selectedReviewCandidateId);

  return (
    <div className="space-y-6">
      {/* Top Banner & Batch Setup Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">새 면접대상자 작성 건</h2>
              <p className="text-xs text-slate-500">
                작성일을 기준으로 만 나이와 '근무중' 경력 개월수가 자동 산정됩니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-700">작성일 (기준일):</span>
              <input
                type="date"
                value={currentBatch.reportDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs font-semibold text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700">시트명:</span>
              <input
                type="text"
                value={currentBatch.sheetName}
                maxLength={31}
                onChange={(e) => onUpdateBatch({ ...currentBatch, sheetName: e.target.value })}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
              />
            </div>

            <button
              onClick={handleLoadSampleData}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="홍길동(근무중 1년10개월, 전문학사 3년제 -1년 감산) 등 가상 지원자 데이터 로드"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              가상 테스트 데이터 로드
            </button>
          </div>
        </div>
      </div>

      {/* Candidates List Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-800">
            현재 작성 건 대상자 ({draftCandidates.length}명)
          </h3>
          {draftCandidates.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
              XLSX 1번째 시트에 수록됨
            </span>
          )}
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          서류 업로드로 지원자 추가
        </button>
      </div>

      {/* Candidate Cards Grid */}
      {draftCandidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <UserCheck className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-slate-700 mb-1">
            등록된 면접 대상자가 없습니다
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            '서류 업로드로 지원자 추가'를 통해 이력서 및 한국건설기술인협회 경력증명서를 업로드하거나,
            '가상 테스트 데이터 로드'를 눌러 시스템 전체를 즉시 테스트해보세요.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              새 지원자 서류 업로드
            </button>
            <button
              onClick={handleLoadSampleData}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer"
            >
              가상 테스트 데이터 로드
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {draftCandidates.map((cand, idx) => {
            const rec = draftRecords.find((r) => r.candidateId === cand.id);
            const hasDeduction = rec && rec.degreeDeductionMonths > 0;
            const hasIssues = rec && rec.issues.length > 0;

            return (
              <div
                key={cand.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-slate-900 text-sm">{cand.nameKo}</h4>
                          <span className="text-[11px] font-semibold text-slate-600">
                            {cand.birthYearDisplay?.split('\n')[0]} (
                            {cand.birthYearDisplay?.split('\n')[1]})
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {cand.resumeContact}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveCandidate(cand.id)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded cursor-pointer transition-colors"
                      title="지원자 제거"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Highlights Badge */}
                  <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">면접 일정:</span>
                      <span className="font-bold text-blue-700">
                        {rec?.interviewDisplayString || '일정 미정'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">수기 직종 / 현장:</span>
                      <span className="font-semibold text-slate-800">
                        {rec?.handwrittenJobType || '(직종 미기재)'} /{' '}
                        {rec?.handwrittenPlacement || '(현장 미기재)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">인정 총경력:</span>
                      <span className="font-bold text-emerald-700 font-mono">
                        {rec?.totalCareerDisplay} ({rec?.totalCareerMonths}개월)
                      </span>
                    </div>
                    {hasDeduction && (
                      <div className="flex justify-between text-red-600 text-[11px] font-medium">
                        <span>학위 감산:</span>
                        <span>{rec?.degreeDeductionLabel}</span>
                      </div>
                    )}
                  </div>

                  {hasIssues && (
                    <div className="mb-3 px-2 py-1.5 bg-amber-50 rounded border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>확인 필요 사유 {rec?.issues.length}건 존재</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">
                    근무처 {rec?.employmentPeriods.length || 0}곳
                  </span>
                  <button
                    onClick={() => setSelectedReviewCandidateId(cand.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    원문 대조 및 수정
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Excel Sheet Layout Preview */}
      {draftCandidates.length > 0 && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-xs text-slate-800">
                엑셀 시트 미리보기 ({currentBatch.sheetName} / 행높이 17pt, 원본 열너비 및 살구색 헤더)
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              * A4 가로, FitToPage 1×1, 좌우 0.8cm 여백 설정이 적용됩니다.
            </span>
          </div>

          <div className="overflow-x-auto p-4 max-h-96">
            <table className="w-full border-collapse text-[11px] text-center border border-slate-300">
              <thead>
                {/* Row 1: Title */}
                <tr className="bg-slate-100 font-bold border-b border-slate-300">
                  <th colSpan={18} className="py-2 text-sm text-slate-800">
                    경력직 면접대상자 ({currentBatch.reportDate})
                  </th>
                </tr>
                {/* Row 2: Headers */}
                <tr className="bg-[#FCE4D6] font-bold text-slate-800 border-b border-slate-300">
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 w-8">순번</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 w-24">면접일정</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 w-12">직종</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 w-16">성명</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 w-16">생년</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 w-32">최종학력</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 w-16">주소</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 w-28">연락처</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 w-28">자격사항</th>
                  <th colSpan={6} className="border border-slate-300 px-2 py-1 bg-[#FCE4D6]">주요경력사항</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 w-28">희망연봉</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 w-16 hidden">예정직급</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 w-16">배치현장</th>
                </tr>
                {/* Row 3: Subheaders */}
                <tr className="bg-[#FCE4D6] font-bold text-slate-800 border-b border-slate-300">
                  <th className="border border-slate-300 px-2 py-1 w-36">근무처</th>
                  <th className="border border-slate-300 px-1 py-1 w-14">직위</th>
                  <th className="border border-slate-300 px-2 py-1 w-20">입사일</th>
                  <th className="border border-slate-300 px-1 py-1 w-6">~</th>
                  <th className="border border-slate-300 px-2 py-1 w-20">퇴사일(근무중)</th>
                  <th className="border border-slate-300 px-2 py-1 w-20">경력기간</th>
                </tr>
              </thead>
              <tbody>
                {draftCandidates.map((cand, cIdx) => {
                  const rec = draftRecords.find((r) => r.candidateId === cand.id);
                  const periods = rec?.employmentPeriods || [];
                  const hasDeduction = rec && rec.degreeDeductionMonths > 0;
                  const totalRows = periods.length + (hasDeduction ? 1 : 0) + 1;

                  return (
                    <React.Fragment key={cand.id}>
                      {periods.map((period, pIdx) => (
                        <tr key={period.id} className="h-[23px] hover:bg-slate-50 border-b border-slate-200">
                          {pIdx === 0 && (
                            <>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white font-mono">
                                {cIdx + 1}
                              </td>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white whitespace-pre-line">
                                {rec?.interviewDisplayString}
                              </td>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white">
                                {rec?.handwrittenJobType}
                              </td>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white font-bold">
                                {cand.nameKo}
                              </td>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white whitespace-pre-line text-[10px]">
                                {cand.birthYearDisplay}
                              </td>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white whitespace-pre-line text-left px-2">
                                {cand.educationDisplay || cand.education.map((e) => `${e.schoolName}\n${e.major}`).join('\n')}
                              </td>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white whitespace-pre-line">
                                {cand.addressCityCountyDistrict}
                              </td>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white font-mono">
                                {cand.resumeContact}
                              </td>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white whitespace-pre-line text-left px-2">
                                {cand.qualificationsDisplay || cand.qualifications.map((q) => q.name).join('\n')}
                              </td>
                            </>
                          )}
                          <td className="border border-slate-300 text-left px-2 font-medium">
                            {period.companyRaw}
                          </td>
                          <td className="border border-slate-300">{period.position}</td>
                          <td className="border border-slate-300 font-mono text-[10px]">{period.startDate}</td>
                          <td className="border border-slate-300 text-slate-400">~</td>
                          <td className="border border-slate-300 font-mono text-[10px]">{period.endDate}</td>
                          <td className="border border-slate-300 font-mono font-medium">{period.durationDisplay}</td>

                          {pIdx === 0 && (
                            <>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white whitespace-pre-line font-medium px-1">
                                {rec?.desiredSalaryDisplay}
                              </td>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white hidden"></td>
                              <td rowSpan={totalRows} className="border border-slate-300 bg-white font-medium">
                                {rec?.handwrittenPlacement}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}

                      {/* Deduction row if any */}
                      {hasDeduction && (
                        <tr className="h-[23px] bg-red-50 text-red-700 border-b border-slate-300">
                          <td colSpan={5} className="border border-slate-300 font-bold text-center">
                            {rec?.degreeDeductionLabel}
                          </td>
                          <td className="border border-slate-300 font-bold font-mono text-center">
                            -{rec?.degreeDeductionMonths / 12}년
                          </td>
                        </tr>
                      )}

                      {/* '계' row */}
                      <tr className="h-[23px] bg-[#FCE4D6] font-bold border-b-2 border-slate-400">
                        <td colSpan={5} className="border border-slate-300 text-center">
                          계
                        </td>
                        <td className="border border-slate-300 font-mono text-center text-blue-900">
                          {rec?.totalCareerDisplay}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom Finalize & Export Bar */}
      {draftCandidates.length > 0 && (
        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              작성 검토 완료: {draftCandidates.length}명의 지원자 데이터
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              '작성 확정 및 저장'을 누르면 종합 누적 DB 및 월별 면접일정에 등록됩니다.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onFinalizeBatch}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              작성 확정 및 저장
            </button>
            <button
              onClick={onDownloadExcel}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5 border border-emerald-400"
            >
              <Download className="w-4 h-4" />
              XLSX 즉시 다운로드
            </button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-800">
                  지원자 서류 업로드 및 AI 판독
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                닫기
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  지원자 성명 (참고용, 비워두면 증명서에서 자동 추출)
                </label>
                <input
                  type="text"
                  placeholder="예: 홍길동"
                  value={uploadCandidateName}
                  onChange={(e) => setUploadCandidateName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  서류 파일 선택 (이력서, 한국건설기술인협회 경력증명서 / PDF, JPG, PNG)
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg"
                  onChange={handleFileSelection}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded p-1"
                />
              </div>

              {pendingFiles.length > 0 && (
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <span className="font-semibold text-slate-700 block mb-1">
                    선택된 파일 ({pendingFiles.length}개):
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                    {pendingFiles.map((f, i) => (
                      <li key={i}>
                        {f.name} ({(f.size / 1024).toFixed(1)} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                * 서버 Gemini 3.8 Flash 모델이 스캔 문서와 수기 메모를 정밀 분석하여 학력, 자격사항, 근무처, 직종 및 배치현장을 구조화합니다.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={isUploading}
                className="px-4 py-2 border border-slate-300 rounded text-slate-700 font-semibold cursor-pointer text-xs"
              >
                취소
              </button>
              <button
                onClick={handleAnalyzeFiles}
                disabled={isUploading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold cursor-pointer text-xs flex items-center gap-1.5"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    문서 정밀 판독 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    판독 및 지원자 추가
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Review & Edit Modal */}
      {reviewTarget && reviewRecord && (
        <DocumentReviewModal
          isOpen={Boolean(selectedReviewCandidateId)}
          onClose={() => setSelectedReviewCandidateId(null)}
          candidate={reviewTarget}
          record={reviewRecord}
          documents={reviewDocs}
          reportDate={currentBatch.reportDate}
          onSave={(updatedCand, updatedRec) => {
            const nextCandidates = draftCandidates.map((c) =>
              c.id === updatedCand.id ? updatedCand : c
            );
            const nextRecords = draftRecords.map((r) =>
              r.id === updatedRec.id ? updatedRec : r
            );
            onUpdateDrafts(nextCandidates, nextRecords, draftDocuments);
          }}
        />
      )}
    </div>
  );
};
