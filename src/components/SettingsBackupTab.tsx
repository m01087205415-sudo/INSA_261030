import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  HardDrive,
  Download,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
  Cpu,
  Layers,
} from 'lucide-react';
import { TemplateProfile, TemplateRole } from '../types';
import { parseUploadedTemplate } from '../utils/templateParser';
import {
  exportFullBackup,
  inspectBackup,
  restoreBackup,
  BackupData,
} from '../utils/db';

interface SettingsBackupTabProps {
  templates: TemplateProfile[];
  onTemplateUploaded: (template: TemplateProfile) => void;
  onDataRestored: () => void;
  candidatesCount: number;
  recordsCount: number;
}

export const SettingsBackupTab: React.FC<SettingsBackupTabProps> = ({
  templates,
  onTemplateUploaded,
  onDataRestored,
  candidatesCount,
  recordsCount,
}) => {
  const [uploadingRole, setUploadingRole] = useState<TemplateRole | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Backup restore states
  const [restoreInspectData, setRestoreInspectData] = useState<{
    valid: boolean;
    version: number;
    exportedAt: string;
    candidatesCount: number;
    recordsCount: number;
    batchesCount: number;
    documentsCount: number;
    templatesCount: number;
    checksumMatched: boolean;
    data: BackupData;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);

  // Template upload handler
  const handleUploadTemplate = async (
    role: TemplateRole,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    setUploadingRole(role);
    setTemplateError(null);

    try {
      const profile = await parseUploadedTemplate(file, role);
      onTemplateUploaded(profile);
    } catch (err: any) {
      console.error(err);
      setTemplateError(`양식 파일 분석 실패: ${err.message || '유효한 엑셀 파일이 아닙니다.'}`);
    } finally {
      setUploadingRole(null);
    }
  };

  // Full backup export handler
  const handleExportBackup = async () => {
    try {
      const json = await exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `채용_면접_전체백업_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`백업 내보내기 실패: ${err.message}`);
    }
  };

  // Backup file inspection handler
  const handleSelectBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    try {
      const text = await file.text();
      const inspectResult = await inspectBackup(text);
      setRestoreInspectData(inspectResult);
      setRestoreSuccessMessage(null);
    } catch (err: any) {
      alert(`백업 파일 오류: ${err.message}`);
    }
  };

  // Execute restore
  const handleExecuteRestore = async () => {
    if (!restoreInspectData) return;
    setIsRestoring(true);
    try {
      await restoreBackup(restoreInspectData.data, restoreMode);
      setRestoreSuccessMessage(
        `복원이 완료되었습니다. (${restoreInspectData.candidatesCount}명 지원자, ${restoreInspectData.recordsCount}건 면접기록 반영)`
      );
      setRestoreInspectData(null);
      onDataRestored();
    } catch (err: any) {
      alert(`복원 실행 실패: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const baseTemplate = templates.find((t) => t.role === 'base');
  const borderTemplate = templates.find((t) => t.role === 'border_sample');
  const calendarTemplate = templates.find((t) => t.role === 'calendar');

  return (
    <div className="space-y-6">
      {/* Browser Local Storage Info Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm flex items-start gap-3.5 border border-slate-800">
        <HardDrive className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-white">단일 사용자 브라우저 로컬 저장소 (IndexedDB)</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              안전한 비공개 저장
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            후보자 정보, 면접 기록, 추출 근거, 원본 엑셀 양식 및 업로드 문서는{' '}
            <strong>현재 사용 중인 브라우저의 IndexedDB에 안전하게 저장</strong>됩니다. 새로고침 후에도
            유지되며, 다른 PC나 외부 서버로 자동 공유되지 않습니다. 안전한 데이터 이동을 위해 정기적으로
            '전체 데이터 백업'을 다운로드하여 보관하세요.
          </p>
        </div>
      </div>

      {/* 1. 세 종류 기준 양식 등록 (Section 3) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b pb-3 border-slate-200">
          <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-bold text-base text-slate-900">
              세 종류 기준 엑셀 양식 등록 및 서식 보존
            </h3>
            <p className="text-xs text-slate-500">
              회사 고유의 열너비, 17pt 행높이, 테두리(hair/가는실선/점선) 및 12개월 달력 양식을 등록합니다.
            </p>
          </div>
        </div>

        {templateError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{templateError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Template 1: Base Standard */}
          <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between bg-slate-50/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-sm">
                  1. 경력직 면접대상자_기준양식.xlsx
                </span>
                {baseTemplate ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    등록됨
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium text-[10px]">
                    기본값 적용중
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-[11px] mb-3 leading-relaxed">
                최종 조정된 열너비(A:4, B:10.5, J:23 등), 본문 행높이 17pt, 표 구조, 인쇄 여백(0.8cm) 기준 파일.
              </p>
              {baseTemplate && (
                <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-[11px] space-y-1 mb-3">
                  <div>파일명: {baseTemplate.fileName}</div>
                  <div>시트명: {baseTemplate.sourceSheetName}</div>
                  <div>열너비 수: {Object.keys(baseTemplate.widths || {}).length}개 열</div>
                </div>
              )}
            </div>

            <div>
              <label className="block w-full text-center py-2 px-3 border border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold cursor-pointer transition-colors">
                {uploadingRole === 'base' ? '분석 중...' : '기준양식 파일 업로드 (.xlsx)'}
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => handleUploadTemplate('base', e)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Template 2: Border Sample */}
          <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between bg-slate-50/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-sm">
                  2. 경력직 면접대상자_서식샘플.xlsx
                </span>
                {borderTemplate ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    등록됨
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium text-[10px]">
                    기본값 적용중
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-[11px] mb-3 leading-relaxed">
                셀별 실선·가는 실선(hair)·점선·선 없음, 살구색 헤더 및 원래 테두리의 대조 기준 파일.
              </p>
              {borderTemplate && (
                <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-[11px] space-y-1 mb-3">
                  <div>파일명: {borderTemplate.fileName}</div>
                  <div>병합 셀 수: {borderTemplate.merges?.length || 0}개</div>
                </div>
              )}
            </div>

            <div>
              <label className="block w-full text-center py-2 px-3 border border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold cursor-pointer transition-colors">
                {uploadingRole === 'border_sample' ? '분석 중...' : '서식샘플 파일 업로드 (.xlsx)'}
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => handleUploadTemplate('border_sample', e)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Template 3: Calendar Standard */}
          <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between bg-slate-50/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-sm">
                  3. 면접일정_원본양식.xlsx
                </span>
                {calendarTemplate ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    등록됨
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium text-[10px]">
                    기본값 적용중
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-[11px] mb-3 leading-relaxed">
                월별 면접일정 달력. 15.78 열너비, 하늘색 요일 헤더, 일요일 빨강, 토요일 파랑, 당직표 제거 단일 시트.
              </p>
              {calendarTemplate && (
                <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-[11px] space-y-1 mb-3">
                  <div>파일명: {calendarTemplate.fileName}</div>
                  <div>시트명: {calendarTemplate.sourceSheetName}</div>
                </div>
              )}
            </div>

            <div>
              <label className="block w-full text-center py-2 px-3 border border-sky-400 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg font-bold cursor-pointer transition-colors">
                {uploadingRole === 'calendar' ? '분석 중...' : '면접일정 양식 업로드 (.xlsx)'}
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => handleUploadTemplate('calendar', e)}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 백업 내보내기 및 복원 (Section 2) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b pb-3 border-slate-200">
          <HardDrive className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="font-bold text-base text-slate-900">데이터 백업 내보내기 및 복원</h3>
            <p className="text-xs text-slate-500">
              현재 저장된 {candidatesCount}명의 지원자와 {recordsCount}건의 면접 기록, 원본 문서 바이트를
              포함하는 무결성 해시(Checksum) 검증 백업을 생성합니다.
            </p>
          </div>
        </div>

        {restoreSuccessMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{restoreSuccessMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Backup Export */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-1">
                <Download className="w-4 h-4 text-blue-600" />
                전체 데이터 백업 다운로드
              </h4>
              <p className="text-slate-500 text-xs leading-relaxed">
                지원자 정보, 작성 건, 면접일정, 엑셀 양식 프로파일 및 업로드된 PDF/이미지 원본 바이트를
                단일 JSON 파일로 암호화 체크섬과 함께 내보냅니다.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              백업 파일 생성 및 다운로드 (.json)
            </button>
          </div>

          {/* Backup Restore */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-1">
                <RotateCcw className="w-4 h-4 text-indigo-600" />
                백업 파일로부터 복원
              </h4>
              <p className="text-slate-500 text-xs leading-relaxed">
                이전에 다운로드한 백업 JSON 파일을 선택하여 비교·병합 또는 전체 덮어쓰기 복원을 수행합니다.
              </p>
            </div>
            <label className="w-full py-2.5 px-4 border border-indigo-400 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs cursor-pointer text-center transition-colors flex items-center justify-center gap-1.5">
              <Upload className="w-4 h-4" />
              백업 파일 선택 (.json)
              <input
                type="file"
                accept=".json"
                onChange={handleSelectBackupFile}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Restore Inspection & Confirmation Modal */}
        {restoreInspectData && (
          <div className="mt-4 p-5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                백업 파일 검증 완료 (체크섬 일치)
              </h4>
              <button
                onClick={() => setRestoreInspectData(null)}
                className="text-slate-500 hover:text-slate-700 font-bold"
              >
                닫기
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-3 rounded-lg border border-indigo-100 font-mono">
              <div>
                <span className="text-slate-400 text-[10px] block">지원자 수</span>
                <span className="font-bold text-indigo-700">{restoreInspectData.candidatesCount}명</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">면접 기록</span>
                <span className="font-bold text-indigo-700">{restoreInspectData.recordsCount}건</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">작성 건(시트)</span>
                <span className="font-bold text-indigo-700">{restoreInspectData.batchesCount}건</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">생성 일시</span>
                <span className="font-bold text-slate-700 text-[10px]">
                  {restoreInspectData.exportedAt.slice(0, 10)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <span className="font-semibold text-slate-700">복원 방식:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                />
                <span>기존 데이터와 병합 (Merge)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'overwrite'}
                  onChange={() => setRestoreMode('overwrite')}
                />
                <span className="text-red-700 font-semibold">기존 데이터 비우고 전체 덮어쓰기</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-indigo-200">
              <button
                onClick={() => setRestoreInspectData(null)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-semibold cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold cursor-pointer shadow-xs flex items-center gap-1"
              >
                {isRestoring ? '복원 처리 중...' : '복원 실행'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. AI 모델 및 분석 설정 */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b pb-3 border-slate-200">
          <Cpu className="w-5 h-5 text-purple-600" />
          <div>
            <h3 className="font-bold text-base text-slate-900">AI 분석 서버 및 모델 구성</h3>
            <p className="text-xs text-slate-500">
              구글 AI Studio의 서버 환경 비밀값(GEMINI_API_KEY)을 안전하게 사용합니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-800 block text-sm">연동 상태</span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-emerald-800">
                서버 프록시 정상 연결됨 (API 키 보호 활성화)
              </span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              * API 키는 브라우저 코드나 다운로드 파일, localStorage에 노출되지 않으며, 서버(/api/gemini/analyze)에서만 처리됩니다.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-800 block text-sm">기본 분석 모델</span>
            <div className="font-mono text-slate-900 font-semibold bg-white p-2 rounded border border-slate-300">
              gemini-3.8-flash (PDF·스캔 문서·수기 메모·구조화 JSON 출력)
            </div>
            <p className="text-slate-500 text-[11px]">
              * User-Agent 헤더 ('aistudio-build') 텔레메트리 규정이 적용되어 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
