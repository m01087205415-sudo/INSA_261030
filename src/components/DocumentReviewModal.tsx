import React, { useState } from 'react';
import {
  X,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Calendar,
  Building,
  User,
  GraduationCap,
  Award,
  DollarSign,
  Phone,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Candidate, InterviewRecord, EmploymentPeriod, StoredDocument } from '../types';
import {
  calculateKoreanAge,
  recalculateCandidateCareer,
  formatAddressDisplay,
  formatEducationDisplay,
  formatQualificationsDisplay,
  formatSalaryDisplay,
  getSeoulToday,
} from '../utils/careerCalc';
import { buildScheduleDisplayText, formatInterviewTime } from '../utils/calendarCalc';

interface DocumentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate;
  record: InterviewRecord;
  documents: StoredDocument[];
  reportDate: string;
  onSave: (updatedCandidate: Candidate, updatedRecord: InterviewRecord) => void;
}

export const DocumentReviewModal: React.FC<DocumentReviewModalProps> = ({
  isOpen,
  onClose,
  candidate,
  record,
  documents,
  reportDate,
  onSave,
}) => {
  if (!isOpen) return null;

  // Local state for editable candidate & record
  const [editedCandidate, setEditedCandidate] = useState<Candidate>({ ...candidate });
  const [editedRecord, setEditedRecord] = useState<InterviewRecord>({ ...record });
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isHandwritingZoomed, setIsHandwritingZoomed] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'career' | 'issues'>('info');

  const activeDoc = documents[selectedDocIndex];

  // Handle career recalculation when periods change
  const handleRecalculateCareer = (newPeriods: EmploymentPeriod[]) => {
    const calc = recalculateCandidateCareer(newPeriods, editedCandidate.education, reportDate);
    setEditedRecord((prev) => ({
      ...prev,
      employmentPeriods: calc.periods,
      degreeDeductionMonths: calc.degreeDeductionMonths,
      degreeDeductionLabel: calc.degreeDeductionLabel,
      totalCareerMonths: calc.netCareerMonths,
      totalCareerDisplay: calc.totalCareerDisplay,
    }));
  };

  // Update birth date and age
  const handleBirthDateChange = (val: string) => {
    const { age, display } = calculateKoreanAge(val, reportDate);
    setEditedCandidate((prev) => ({
      ...prev,
      birthDate: val,
      calculatedAge: age || undefined,
      birthYearDisplay: display,
    }));
  };

  // Add employment period row
  const handleAddPeriod = () => {
    const newPeriod: EmploymentPeriod = {
      id: `period_${Date.now()}`,
      companyRaw: '',
      startDate: `${getSeoulToday().slice(0, 4)}-01-01`,
      endDate: '근무중',
      isCurrentlyEmployed: true,
      position: '미기재',
      months: 0,
      durationDisplay: '0년 0개월',
      order: editedRecord.employmentPeriods.length + 1,
    };
    const updated = [newPeriod, ...editedRecord.employmentPeriods];
    handleRecalculateCareer(updated);
  };

  // Remove employment period
  const handleRemovePeriod = (id: string) => {
    const updated = editedRecord.employmentPeriods.filter((p) => p.id !== id);
    handleRecalculateCareer(updated);
  };

  // Update period field
  const handleUpdatePeriod = (id: string, field: keyof EmploymentPeriod, value: any) => {
    const updated = editedRecord.employmentPeriods.map((p) => {
      if (p.id !== id) return p;
      const modified = { ...p, [field]: value };
      if (field === 'endDate') {
        modified.isCurrentlyEmployed = value === '근무중' || value === '';
      }
      return modified;
    });
    handleRecalculateCareer(updated);
  };

  // Save all edits
  const handleConfirmSave = () => {
    // Sync displays
    const updatedCand: Candidate = {
      ...editedCandidate,
      addressCityCountyDistrict: formatAddressDisplay(editedCandidate.addressCityCountyDistrict),
      educationDisplay: formatEducationDisplay(editedCandidate.education),
      qualificationsDisplay: formatQualificationsDisplay(editedCandidate.qualifications),
    };

    const timeFormatted = formatInterviewTime(editedRecord.interviewTimeParsed || '');
    const placement = editedRecord.placementOverride || editedRecord.handwrittenPlacement || '';
    const jobType = editedRecord.jobTypeOverride || editedRecord.handwrittenJobType || '';
    const calendarTitle = buildScheduleDisplayText(
      updatedCand.nameKo,
      placement,
      jobType,
      timeFormatted
    );

    const updatedRec: InterviewRecord = {
      ...editedRecord,
      candidateName: updatedCand.nameKo,
      calendarDisplayTitle: calendarTitle,
      desiredSalaryDisplay: formatSalaryDisplay(
        editedRecord.desiredSalaryRaw,
        editedRecord.previousSalaryManwon
      ),
      interviewDisplayString: editedRecord.interviewDateParsed
        ? `${editedRecord.interviewDateParsed}\n${editedRecord.interviewTimeParsed || ''}`
        : editedRecord.interviewDateTimeRaw || '일정 미정',
      confirmedAt: new Date().toISOString(),
    };

    onSave(updatedCand, updatedRec);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              {editedCandidate.nameKo.charAt(0) || '지'}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">
                  {editedCandidate.nameKo} 지원자 원문 대조 및 정보 수정
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                  작성일 기준: {reportDate}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                좌측 증빙 문서(이력서·경력증명서)와 우측 판독값을 대조하고 수정합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Split Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Document Viewer (45%) */}
          <div className="w-full md:w-5/12 border-r border-slate-200 bg-slate-100 flex flex-col overflow-hidden">
            {/* Viewer Controls */}
            <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">증빙 문서:</span>
                {documents.length > 0 ? (
                  <select
                    value={selectedDocIndex}
                    onChange={(e) => setSelectedDocIndex(Number(e.target.value))}
                    className="border border-slate-300 rounded px-2 py-1 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {documents.map((d, i) => (
                      <option key={d.id} value={i}>
                        {d.fileName} ({d.docType === 'resume' ? '이력서' : '경력증명서'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-400 italic">연결된 원본 파일 없음 (텍스트 근거 모드)</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsHandwritingZoomed(!isHandwritingZoomed)}
                  className={`px-2 py-1 rounded text-xs font-medium border flex items-center gap-1 cursor-pointer transition-colors ${
                    isHandwritingZoomed
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="이력서 상단 수기 메모(직종/배치현장/면접일시) 영역 집중 확대"
                >
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  수기메모 확대
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 20))}
                  className="p-1 rounded hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                  title="축소"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-slate-600 font-mono w-10 text-center">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(250, z + 20))}
                  className="p-1 rounded hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                  title="확대"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(100);
                    setIsHandwritingZoomed(false);
                  }}
                  className="p-1 rounded hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                  title="초기화"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Document Render Area */}
            <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-slate-200/70">
              {activeDoc ? (
                <div
                  className="bg-white shadow-lg rounded p-4 max-w-full transition-transform origin-top-left"
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: isHandwritingZoomed ? 'top center' : 'top left',
                  }}
                >
                  {activeDoc.mimeType.startsWith('image/') ? (
                    <img
                      src={`data:${activeDoc.mimeType};base64,${activeDoc.base64Data}`}
                      alt={activeDoc.fileName}
                      className="max-w-full h-auto object-contain rounded"
                    />
                  ) : (
                    <div className="w-[600px] min-h-[800px] bg-white p-6 border border-slate-300 font-sans text-xs">
                      <div className="border-b-2 border-slate-800 pb-2 mb-4 flex justify-between items-center">
                        <span className="font-bold text-sm text-slate-800">
                          {activeDoc.docType === 'resume' ? '입사지원서 (이력서)' : '건설기술인 경력증명서'}
                        </span>
                        <span className="text-slate-500 font-mono">{activeDoc.fileName}</span>
                      </div>

                      {/* Handwritten Highlight Box */}
                      {isHandwritingZoomed && (
                        <div className="mb-4 p-3 bg-amber-50 border-2 border-amber-400 rounded shadow-xs">
                          <div className="flex items-center gap-1.5 text-amber-900 font-bold mb-1">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                            [인사담당자 펜 수기 메모 판독 영역]
                          </div>
                          <div className="text-sm font-mono text-slate-800 bg-white p-2 rounded border border-amber-200">
                            "{editedRecord.handwrittenPlacement || '본사'} (
                            {editedRecord.handwrittenJobType || '외주'}) /{' '}
                            {editedRecord.interviewDateTimeRaw || '11/3(화) 14시'}"
                          </div>
                          <p className="text-[11px] text-amber-700 mt-1">
                            * 판독 위치: 이력서 우측 상단 여백 / 수기 직종 및 배치현장
                          </p>
                        </div>
                      )}

                      {/* Text Representation of Document Content */}
                      <div className="space-y-4 text-slate-700">
                        <div className="p-3 bg-slate-50 rounded border border-slate-200">
                          <span className="font-semibold text-slate-900 block mb-1">성명 및 기본사항:</span>
                          <p>성명: {editedCandidate.nameKo} (한글 성명)</p>
                          <p>생년월일: {editedCandidate.birthDate || '확인 필요'}</p>
                          <p>연락처: {editedCandidate.resumeContact}</p>
                        </div>

                        <div className="p-3 bg-slate-50 rounded border border-slate-200">
                          <span className="font-semibold text-slate-900 block mb-1">경력증명서 발췌 근무처:</span>
                          <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
                            {editedRecord.employmentPeriods.map((p, idx) => (
                              <li key={p.id}>
                                {p.companyRaw} ({p.startDate} ~ {p.endDate}) / 직위: {p.position}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-3 bg-slate-50 rounded border border-slate-200">
                          <span className="font-semibold text-slate-900 block mb-1">학력 및 자격:</span>
                          <p>학력: {editedCandidate.education.map((e) => `${e.schoolName} ${e.major} (${e.degreeType || '학사'})`).join(', ')}</p>
                          <p>자격사항: {editedCandidate.qualifications.map((q) => q.name).join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-8 text-slate-500">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="font-medium text-sm">연결된 원본 파일이 없습니다.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    우측 폼에서 지원자 정보를 직접 확인 및 수정할 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Editable Table & Rules (55%) */}
          <div className="w-full md:w-7/12 flex flex-col bg-white overflow-hidden">
            {/* Tab navigation */}
            <div className="flex border-b border-slate-200 px-4 bg-slate-50 text-xs">
              <button
                onClick={() => setActiveTab('info')}
                className={`py-3 px-3 font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeTab === 'info'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                1. 인적사항 & 수기 메모 & 급여
              </button>
              <button
                onClick={() => setActiveTab('career')}
                className={`py-3 px-3 font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeTab === 'career'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                2. 근무처 & 직위 & 경력계산 ({editedRecord.employmentPeriods.length}건)
              </button>
              <button
                onClick={() => setActiveTab('issues')}
                className={`py-3 px-3 font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-1 ${
                  activeTab === 'issues'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                3. 검토 사항
                {editedRecord.issues.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {editedRecord.issues.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab 1: Info & Handwriting */}
            {activeTab === 'info' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-5 text-xs">
                {/* Basic Personal Info */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    기본 인적사항 (경력증명서 기준)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        성명 (한글 성명만)
                      </label>
                      <input
                        type="text"
                        value={editedCandidate.nameKo}
                        onChange={(e) =>
                          setEditedCandidate({ ...editedCandidate, nameKo: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        생년월일 (YYYY-MM-DD)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={editedCandidate.birthDate}
                          onChange={(e) => handleBirthDateChange(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900 font-mono"
                        />
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-semibold whitespace-pre-line text-center text-[11px]">
                          {editedCandidate.birthYearDisplay || '만나이 계산'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        연락처 (선행 0 보존)
                      </label>
                      <input
                        type="text"
                        value={editedCandidate.resumeContact}
                        onChange={(e) =>
                          setEditedCandidate({ ...editedCandidate, resumeContact: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        주소 (시·군·구까지만)
                      </label>
                      <input
                        type="text"
                        value={editedCandidate.addressCityCountyDistrict}
                        onChange={(e) =>
                          setEditedCandidate({
                            ...editedCandidate,
                            addressCityCountyDistrict: e.target.value,
                          })
                        }
                        placeholder="예: 서울 성북구, 경기 안양시 만안구"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Handwritten notes on resume (Section 5) */}
                <div className="bg-amber-50/70 p-4 rounded-lg border border-amber-200 space-y-3">
                  <h3 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    인사담당자 수기 메모 (C열 직종 / R열 배치현장 / B열 면접일시)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        직종 (C열, 예: 외주, 건축)
                      </label>
                      <input
                        type="text"
                        value={editedRecord.jobTypeOverride || editedRecord.handwrittenJobType}
                        onChange={(e) =>
                          setEditedRecord({
                            ...editedRecord,
                            jobTypeOverride: e.target.value,
                            handwrittenJobType: e.target.value,
                          })
                        }
                        placeholder="공란 가능"
                        className="w-full px-2.5 py-1.5 border border-amber-300 rounded bg-white text-slate-900 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        배치현장 (R열, 예: 본사, 서울현장)
                      </label>
                      <input
                        type="text"
                        value={editedRecord.placementOverride || editedRecord.handwrittenPlacement}
                        onChange={(e) =>
                          setEditedRecord({
                            ...editedRecord,
                            placementOverride: e.target.value,
                            handwrittenPlacement: e.target.value,
                          })
                        }
                        placeholder="공란 가능"
                        className="w-full px-2.5 py-1.5 border border-amber-300 rounded bg-white text-slate-900 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        면접일시 원문 (수기 표기)
                      </label>
                      <input
                        type="text"
                        value={editedRecord.interviewDateTimeRaw}
                        onChange={(e) =>
                          setEditedRecord({ ...editedRecord, interviewDateTimeRaw: e.target.value })
                        }
                        placeholder="예: 11월 3일(화) 오후 2시"
                        className="w-full px-2.5 py-1.5 border border-amber-300 rounded bg-white text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        정규화 면접 날짜 (YYYY-MM-DD)
                      </label>
                      <input
                        type="date"
                        value={editedRecord.interviewDateParsed || ''}
                        onChange={(e) =>
                          setEditedRecord({
                            ...editedRecord,
                            interviewDateParsed: e.target.value || null,
                            interviewDateTime: e.target.value
                              ? `${e.target.value}T${editedRecord.interviewTimeParsed || '14:00'}:00`
                              : null,
                          })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        정규화 면접 시간 (HH:mm, 24시간제)
                      </label>
                      <input
                        type="time"
                        value={editedRecord.interviewTimeParsed || ''}
                        onChange={(e) =>
                          setEditedRecord({
                            ...editedRecord,
                            interviewTimeParsed: e.target.value || null,
                            interviewDateTime: editedRecord.interviewDateParsed
                              ? `${editedRecord.interviewDateParsed}T${e.target.value || '14:00'}:00`
                              : null,
                          })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Salary Info */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    연봉 정보 (단위: 만원)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        희망연봉 원문 (P열 상단)
                      </label>
                      <input
                        type="text"
                        value={editedRecord.desiredSalaryRaw}
                        onChange={(e) =>
                          setEditedRecord({ ...editedRecord, desiredSalaryRaw: e.target.value })
                        }
                        placeholder="예: 5,000~6,000 또는 회사내규에 따름"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        직전연봉 (숫자 만원, 괄호 병기)
                      </label>
                      <input
                        type="number"
                        value={editedRecord.previousSalaryManwon || ''}
                        onChange={(e) =>
                          setEditedRecord({
                            ...editedRecord,
                            previousSalaryManwon: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        placeholder="예: 4500"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-900 font-mono"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 bg-white p-2 rounded border border-slate-200">
                    표시 미리보기:{' '}
                    <span className="font-semibold text-slate-800 whitespace-pre-line">
                      {formatSalaryDisplay(
                        editedRecord.desiredSalaryRaw,
                        editedRecord.previousSalaryManwon
                      ) || '(공란)'}
                    </span>
                  </div>
                </div>

                {/* Education & Qualifications */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-purple-600" />
                      최종 학력 (F열)
                    </h3>
                    <textarea
                      rows={3}
                      value={editedCandidate.education
                        .map((e) => `${e.schoolName} / ${e.major} (${e.degreeType || '학사'})`)
                        .join('\n')}
                      onChange={(e) => {
                        const lines = e.target.value.split('\n');
                        const edus = lines.map((l) => {
                          const parts = l.split('/');
                          return {
                            schoolName: parts[0]?.trim() || '',
                            major: parts[1]?.trim() || '',
                            degreeType: l.includes('3년제') ? '전문학사(3년제)' : l.includes('전문') ? '전문학사' : '학사',
                          };
                        });
                        setEditedCandidate({ ...editedCandidate, education: edus });
                        // Recalculate degree deduction
                        const calc = recalculateCandidateCareer(
                          editedRecord.employmentPeriods,
                          edus,
                          reportDate
                        );
                        setEditedRecord((prev) => ({
                          ...prev,
                          degreeDeductionMonths: calc.degreeDeductionMonths,
                          degreeDeductionLabel: calc.degreeDeductionLabel,
                          totalCareerMonths: calc.netCareerMonths,
                          totalCareerDisplay: calc.totalCareerDisplay,
                        }));
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs leading-relaxed"
                    />
                    <p className="text-[11px] text-slate-500">
                      * 학교명과 학과는 줄바꿈되며, '전문학사(3년제)'는 -1년, '전문학사'는 -2년 감산됩니다.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-600" />
                      자격사항 (I열, 국가기술자격만)
                    </h3>
                    <textarea
                      rows={3}
                      value={editedCandidate.qualifications.map((q) => q.name).join('\n')}
                      onChange={(e) => {
                        const lines = e.target.value.split('\n');
                        setEditedCandidate({
                          ...editedCandidate,
                          qualifications: lines.filter(Boolean).map((n) => ({ name: n.trim() })),
                        });
                      }}
                      placeholder="한 줄에 자격증 하나씩 입력 (초급/중급 등 협회 등급 제외)"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Career Periods */}
            {activeTab === 'career' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      근무처별 기간 및 직위 (경력증명서 기준 내림차순)
                    </h3>
                    <p className="text-xs text-slate-500">
                      DATEDIF 완성 개월수로 계산되며, 현재 근무중인 직장은 작성일({reportDate})까지 자동 계산됩니다.
                    </p>
                  </div>
                  <button
                    onClick={handleAddPeriod}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    근무처 추가
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2 w-8 text-center">#</th>
                        <th className="p-2">근무처 (J열)</th>
                        <th className="p-2 w-24">직위 (K열)</th>
                        <th className="p-2 w-28">입사일 (L열)</th>
                        <th className="p-2 w-28">퇴사일/근무중 (N열)</th>
                        <th className="p-2 w-24 text-center">인정기간 (O열)</th>
                        <th className="p-2 w-10 text-center">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {editedRecord.employmentPeriods.map((period, idx) => (
                        <tr key={period.id} className="hover:bg-slate-50">
                          <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={period.companyRaw}
                              onChange={(e) =>
                                handleUpdatePeriod(period.id, 'companyRaw', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-slate-200 rounded text-slate-900 font-medium"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={period.position}
                              onChange={(e) =>
                                handleUpdatePeriod(period.id, 'position', e.target.value)
                              }
                              placeholder="미기재"
                              className="w-full px-2 py-1 border border-slate-200 rounded text-slate-900 text-center"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="date"
                              value={period.startDate}
                              onChange={(e) =>
                                handleUpdatePeriod(period.id, 'startDate', e.target.value)
                              }
                              className="w-full px-1.5 py-1 border border-slate-200 rounded text-slate-900 font-mono text-[11px]"
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {period.isCurrentlyEmployed ? (
                                <button
                                  onClick={() =>
                                    handleUpdatePeriod(
                                      period.id,
                                      'endDate',
                                      getSeoulToday()
                                    )
                                  }
                                  className="w-full py-1 px-2 bg-emerald-100 text-emerald-800 rounded font-semibold text-center hover:bg-emerald-200 cursor-pointer text-[11px]"
                                >
                                  근무중
                                </button>
                              ) : (
                                <input
                                  type="date"
                                  value={period.endDate}
                                  onChange={(e) =>
                                    handleUpdatePeriod(period.id, 'endDate', e.target.value)
                                  }
                                  className="w-full px-1.5 py-1 border border-slate-200 rounded text-slate-900 font-mono text-[11px]"
                                />
                              )}
                              <button
                                onClick={() =>
                                  handleUpdatePeriod(
                                    period.id,
                                    'endDate',
                                    period.isCurrentlyEmployed ? getSeoulToday() : '근무중'
                                  )
                                }
                                className="px-1.5 py-1 border rounded text-[10px] text-slate-500 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                                title="근무중/일자 토글"
                              >
                                {period.isCurrentlyEmployed ? '날짜' : '재직'}
                              </button>
                            </div>
                          </td>
                          <td className="p-2 text-center font-bold text-slate-800 font-mono">
                            {period.durationDisplay}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleRemovePeriod(period.id)}
                              className="text-slate-400 hover:text-red-500 p-1 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Deduction and Summary Bar */}
                <div className="bg-slate-100 p-4 rounded-lg border border-slate-300 space-y-2">
                  {editedRecord.degreeDeductionMonths > 0 && (
                    <div className="flex items-center justify-between text-red-700 bg-red-50 px-3 py-2 rounded border border-red-200">
                      <span className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        {editedRecord.degreeDeductionLabel}
                      </span>
                      <span className="font-mono font-bold">
                        -{editedRecord.degreeDeductionMonths / 12}년 (-{editedRecord.degreeDeductionMonths}개월)
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-700 font-bold text-sm">최종 인정 총경력 (계):</span>
                    <span className="text-lg font-bold text-blue-700 font-mono bg-blue-50 px-3 py-1 rounded border border-blue-200">
                      {editedRecord.totalCareerDisplay} ({editedRecord.totalCareerMonths}개월)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Issues */}
            {activeTab === 'issues' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-3 text-xs">
                <h3 className="font-bold text-slate-800 text-sm">
                  문서 분석 불일치 및 검토 필요 사항
                </h3>
                {editedRecord.issues.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">확인이 필요한 충돌이나 누락 사항이 없습니다.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      모든 인적사항과 경력기간이 정상적으로 대조되었습니다.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editedRecord.issues.map((iss) => (
                      <div
                        key={iss.id}
                        className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                          iss.severity === 'error'
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : iss.severity === 'warning'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-blue-50 border-blue-200 text-blue-800'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold block mb-0.5">{iss.message}</span>
                          <span className="text-[11px] opacity-80">항목: {iss.fieldPath}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                수정 완료 후 '저장 및 반영'을 누르면 초안과 종합 데이터에 즉시 반영됩니다.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 cursor-pointer text-xs"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmSave}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  저장 및 반영
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
