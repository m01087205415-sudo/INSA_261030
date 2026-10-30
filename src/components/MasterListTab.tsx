import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  Calendar,
  Building,
  Phone,
  Eye,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { Candidate, InterviewRecord, StoredDocument } from '../types';
import { DocumentReviewModal } from './DocumentReviewModal';
import { getSeoulToday } from '../utils/careerCalc';

interface MasterListTabProps {
  candidates: Candidate[];
  records: InterviewRecord[];
  documents: StoredDocument[];
  onUpdateRecord: (candidate: Candidate, record: InterviewRecord) => void;
  onDeleteRecord: (recordId: string) => void;
  onDownloadExcel: () => void;
}

export const MasterListTab: React.FC<MasterListTabProps> = ({
  candidates,
  records,
  documents,
  onUpdateRecord,
  onDeleteRecord,
  onDownloadExcel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);

  const candidatesMap = useMemo(() => {
    const map = new Map<string, Candidate>();
    candidates.forEach((c) => map.set(c.id, c));
    return map;
  }, [candidates]);

  // Unique job types for filter
  const uniqueJobTypes = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      const j = r.jobTypeOverride || r.handwrittenJobType;
      if (j) set.add(j);
    });
    return Array.from(set);
  }, [records]);

  // Filter & deterministic sorting:
  // Interview datetime descending, unscheduled at the very bottom
  const filteredRecords = useMemo(() => {
    return records
      .filter((rec) => {
        const cand = candidatesMap.get(rec.candidateId);
        if (!cand) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const nameMatch = cand.nameKo.toLowerCase().includes(q);
          const contactMatch = cand.resumeContact.includes(q);
          const companyMatch = rec.employmentPeriods.some((p) =>
            p.companyRaw.toLowerCase().includes(q)
          );
          if (!nameMatch && !contactMatch && !companyMatch) return false;
        }

        // Job type
        if (jobTypeFilter !== 'all') {
          const j = rec.jobTypeOverride || rec.handwrittenJobType;
          if (j !== jobTypeFilter) return false;
        }

        // Date range
        const recDate = rec.interviewDateParsed || (rec.interviewDateTime ? rec.interviewDateTime.slice(0, 10) : null);
        if (startDateFilter && recDate && recDate < startDateFilter) return false;
        if (endDateFilter && recDate && recDate > endDateFilter) return false;

        return true;
      })
      .sort((a, b) => {
        // Unscheduled placed at the very bottom
        const hasDateA = Boolean(a.interviewDateParsed || a.interviewDateTime);
        const hasDateB = Boolean(b.interviewDateParsed || b.interviewDateTime);

        if (!hasDateA && hasDateB) return 1;
        if (hasDateA && !hasDateB) return -1;
        if (!hasDateA && !hasDateB) return a.candidateName.localeCompare(b.candidateName);

        const dateA = a.interviewDateTime || a.interviewDateParsed || '';
        const dateB = b.interviewDateTime || b.interviewDateParsed || '';
        return dateB.localeCompare(dateA); // Descending (latest first)
      });
  }, [records, candidatesMap, searchQuery, jobTypeFilter, startDateFilter, endDateFilter]);

  const targetCandidate = candidatesMap.get(editingCandidateId || '');
  const targetRecord = records.find((r) => r.candidateId === editingCandidateId);
  const targetDocs = documents.filter((d) => d.candidateId === editingCandidateId);

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Summary Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">면접대상자 종합 관리</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                  누적 {records.length}명
                </span>
              </div>
              <p className="text-xs text-slate-500">
                과거 작성 건과 신규 확정 건이 통합 보존되며, 면접일정 최신순(미정은 최하단)으로 정렬됩니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBrowserPrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-300"
            >
              <Printer className="w-3.5 h-3.5" />
              인쇄 미리보기
            </button>
            <button
              onClick={onDownloadExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs border border-emerald-400"
            >
              <Download className="w-3.5 h-3.5" />
              종합 엑셀 다운로드
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="성명, 근무처, 연락처 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium shrink-0">기간:</span>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-mono text-[11px]"
            />
            <span className="text-slate-400">~</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-mono text-[11px]"
            />
          </div>

          <div>
            <select
              value={jobTypeFilter}
              onChange={(e) => setJobTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">모든 직종</option>
              {uniqueJobTypes.map((j) => (
                <option key={j} value={j}>
                  직종: {j}
                </option>
              ))}
            </select>
          </div>

          {(searchQuery || startDateFilter || endDateFilter || jobTypeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStartDateFilter('');
                setEndDateFilter('');
                setJobTypeFilter('all');
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-semibold text-xs cursor-pointer text-center"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Records Table */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="font-bold text-slate-700 text-base">조건에 부합하는 면접대상자가 없습니다</p>
          <p className="text-xs text-slate-400 mt-1">검색어나 기간 필터를 조정해보세요.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3 w-28">면접일정</th>
                  <th className="p-3 w-20">직종 / 현장</th>
                  <th className="p-3 w-24">성명 / 생년</th>
                  <th className="p-3 w-40">최종학력</th>
                  <th className="p-3 w-32">연락처 / 주소</th>
                  <th className="p-3 w-48">주요 경력사항</th>
                  <th className="p-3 w-28 text-center">총경력 (계)</th>
                  <th className="p-3 w-32">희망연봉(직전)</th>
                  <th className="p-3 w-24 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecords.map((rec, idx) => {
                  const cand = candidatesMap.get(rec.candidateId);
                  const isUnscheduled = !rec.interviewDateParsed && !rec.interviewDateTime;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3">
                        {isUnscheduled ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[11px]">
                            일정 미정
                          </span>
                        ) : (
                          <div className="font-mono text-slate-800">
                            <span className="font-bold block text-blue-700">
                              {rec.interviewDateParsed}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {rec.interviewTimeParsed || '시간 미지정'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-800 block">
                          {rec.jobTypeOverride || rec.handwrittenJobType || '-'}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {rec.placementOverride || rec.handwrittenPlacement || '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block text-sm">
                          {rec.candidateName}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {cand?.birthYearDisplay?.split('\n').join(' ')}
                        </span>
                      </td>
                      <td className="p-3 whitespace-pre-line text-slate-700 leading-tight">
                        {cand?.educationDisplay ||
                          cand?.education.map((e) => `${e.schoolName} ${e.major}`).join('\n')}
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-slate-800 block">{cand?.resumeContact}</span>
                        <span className="text-slate-500 text-[11px]">
                          {cand?.addressCityCountyDistrict?.split('\n').join(' ')}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="space-y-0.5 font-mono text-[11px] max-w-xs truncate">
                          {rec.employmentPeriods.slice(0, 2).map((p) => (
                            <div key={p.id} className="truncate">
                              • {p.companyRaw} ({p.position})
                            </div>
                          ))}
                          {rec.employmentPeriods.length > 2 && (
                            <span className="text-slate-400 text-[10px]">
                              외 {rec.employmentPeriods.length - 2}곳
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-bold text-blue-700 font-mono bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                          {rec.totalCareerDisplay}
                        </span>
                        {rec.degreeDeductionMonths > 0 && (
                          <span className="block text-[10px] text-red-600 font-medium mt-1">
                            {rec.degreeDeductionLabel}
                          </span>
                        )}
                      </td>
                      <td className="p-3 whitespace-pre-line text-slate-700 text-[11px] font-medium leading-tight">
                        {rec.desiredSalaryDisplay || '-'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingCandidateId(rec.candidateId)}
                            className="p-1.5 rounded hover:bg-blue-100 text-blue-600 cursor-pointer"
                            title="상세 확인 및 수정"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`${rec.candidateName} 지원자의 기록을 삭제하시겠습니까?`)) {
                                onDeleteRecord(rec.id);
                              }
                            }}
                            className="p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 cursor-pointer"
                            title="기록 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail & Edit Modal */}
      {targetCandidate && targetRecord && (
        <DocumentReviewModal
          isOpen={Boolean(editingCandidateId)}
          onClose={() => setEditingCandidateId(null)}
          candidate={targetCandidate}
          record={targetRecord}
          documents={targetDocs}
          reportDate={targetRecord.reportDateSnapshot || getSeoulToday()}
          onSave={(updatedCand, updatedRec) => {
            onUpdateRecord(updatedCand, updatedRec);
          }}
        />
      )}
    </div>
  );
};
