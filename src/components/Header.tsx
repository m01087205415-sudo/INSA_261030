import React from 'react';
import {
  FileSpreadsheet,
  Calendar,
  Users,
  Settings,
  PlusCircle,
  HardDrive,
  Download,
} from 'lucide-react';

export type ActiveTab = 'new_batch' | 'master_list' | 'calendar' | 'settings_backup';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onDownloadRecruitExcel: () => void;
  onDownloadCalendarExcel: () => void;
  hasCandidates: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onDownloadRecruitExcel,
  onDownloadCalendarExcel,
  hasCandidates,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight">채용_면접</span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-200 border border-blue-700 font-medium">
                  건설기술인 판독 시스템
                </span>
              </div>
              <p className="text-xs text-slate-400">
                경력증명서·이력서 자동 판독, 결정적 경력계산, 원본 서식 보존 엑셀 생성
              </p>
            </div>
          </div>

          {/* Quick Download Buttons */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={onDownloadRecruitExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white shadow-sm transition-colors border border-emerald-500 cursor-pointer"
              title="새 작성 시트와 종합 시트가 포함된 면접대상자 XLSX 다운로드"
            >
              <Download className="w-3.5 h-3.5" />
              면접대상자 관리표 (.xlsx)
            </button>
            <button
              onClick={onDownloadCalendarExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-sky-700 hover:bg-sky-600 text-white shadow-sm transition-colors border border-sky-500 cursor-pointer"
              title="12개월 연속 월별 면접일정 XLSX 다운로드"
            >
              <Download className="w-3.5 h-3.5" />
              월별 면접일정 (.xlsx)
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-1 -mb-px">
          <nav className="flex space-x-1 sm:space-x-2">
            <button
              onClick={() => onTabChange('new_batch')}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'new_batch'
                  ? 'border-blue-400 text-blue-400 bg-slate-800/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>새 면접대상자 작성</span>
            </button>

            <button
              onClick={() => onTabChange('master_list')}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'master_list'
                  ? 'border-blue-400 text-blue-400 bg-slate-800/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>종합 관리</span>
            </button>

            <button
              onClick={() => onTabChange('calendar')}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'calendar'
                  ? 'border-blue-400 text-blue-400 bg-slate-800/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>월별 면접일정</span>
            </button>

            <button
              onClick={() => onTabChange('settings_backup')}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'settings_backup'
                  ? 'border-blue-400 text-blue-400 bg-slate-800/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>양식 설정·백업</span>
            </button>
          </nav>

          {/* Storage notification */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-emerald-400 py-1">
            <HardDrive className="w-3.5 h-3.5" />
            <span>이 브라우저(IndexedDB)에 저장됨</span>
          </div>
        </div>
      </div>
    </header>
  );
};
