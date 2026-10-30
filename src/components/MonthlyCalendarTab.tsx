import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Briefcase,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { InterviewRecord, CalendarSettings } from '../types';
import {
  generateMonthCalendarGrid,
  getRolling12Months,
  formatInterviewTime,
  buildScheduleDisplayText,
} from '../utils/calendarCalc';
import { preloadPublicHolidays } from '../utils/holidays';

interface MonthlyCalendarTabProps {
  records: InterviewRecord[];
  settings: CalendarSettings;
  onUpdateSettings: (settings: CalendarSettings) => void;
  onDownloadCalendarExcel: () => void;
  onSelectCandidate: (candidateId: string) => void;
}

export const MonthlyCalendarTab: React.FC<MonthlyCalendarTabProps> = ({
  records,
  settings,
  onUpdateSettings,
  onDownloadCalendarExcel,
  onSelectCandidate,
}) => {
  const rollingMonths = useMemo(() => {
    return getRolling12Months(settings.basisMonth);
  }, [settings.basisMonth]);

  const [activeMonth, setActiveMonth] = useState<string>(settings.basisMonth);

  // Preload holiday data from public data API / computation engine
  useEffect(() => {
    const [y] = activeMonth.split('-');
    const yearNum = parseInt(y, 10);
    preloadPublicHolidays(yearNum);
    preloadPublicHolidays(yearNum - 1);
  }, [activeMonth]);

  // Month calendar grid calculation
  const calendarGrid = useMemo(() => {
    return generateMonthCalendarGrid(activeMonth, records);
  }, [activeMonth, records]);

  // Unscheduled records count
  const unscheduledRecords = useMemo(() => {
    return records.filter(
      (r) => !r.interviewDateParsed && !r.interviewDateTime && r.status !== 'cancelled'
    );
  }, [records]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Month Selector */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">월별 면접일정표</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                  최근 12개월 연속 시트
                </span>
              </div>
              <p className="text-xs text-slate-500">
                1일 최대 4개 슬롯, `성명(배치현장_직종) - 시간` 표준 양식과 자동 글자 축소(shrinkToFit)가 적용됩니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Basis Month Selector */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700">기준월 (최신):</span>
              <input
                type="month"
                value={settings.basisMonth}
                onChange={(e) => {
                  if (e.target.value) {
                    onUpdateSettings({ ...settings, basisMonth: e.target.value, basisMode: 'manual' });
                    setActiveMonth(e.target.value);
                  }
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs font-semibold text-sky-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-300"
            >
              <Printer className="w-3.5 h-3.5" />
              달력 인쇄
            </button>

            <button
              onClick={onDownloadCalendarExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs border border-sky-400"
              title="12개월 연속 월별 면접일정 통합문서 XLSX 다운로드"
            >
              <Download className="w-3.5 h-3.5" />
              월별 면접일정 XLSX 다운로드
            </button>
          </div>
        </div>

        {/* 12-Month Tabs bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold px-2 shrink-0">12개월 탭:</span>
          {rollingMonths.map((ym) => {
            const isActive = ym === activeMonth;
            const [y, m] = ym.split('-');
            return (
              <button
                key={ym}
                onClick={() => setActiveMonth(ym)}
                className={`px-3 py-1.5 rounded-lg font-bold font-mono transition-colors shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {y}년 {parseInt(m, 10)}월
              </button>
            );
          })}
        </div>
      </div>

      {/* Overflow & Unscheduled warnings */}
      {(calendarGrid.overflowTotal > 0 || unscheduledRecords.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {calendarGrid.overflowTotal > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm">
                  하루 4건 초과 면접 존재 (총 {calendarGrid.overflowTotal}건 초과)
                </span>
                <p className="text-amber-700 mt-0.5">
                  원본 양식은 일자당 4행 슬롯으로 구성되어 있습니다. 초과된 일정은 담당자 시간 조율이 필요합니다.
                </p>
              </div>
            </div>
          )}

          {unscheduledRecords.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-900">
              <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm">
                  면접일정 미정 지원자: {unscheduledRecords.length}명
                </span>
                <p className="text-blue-700 mt-0.5">
                  날짜 및 시간이 판독되지 않거나 조율 중인 지원자는 달력에 임의 배치되지 않습니다.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendar Grid Sheet View */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Calendar Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 text-center relative">
          <h3 className="text-2xl font-bold tracking-widest text-[#1F4E79] font-sans">
            면  접  일  정
          </h3>
          <div className="sm:absolute right-6 top-6 text-sm font-bold text-slate-700 font-mono mt-2 sm:mt-0">
            {calendarGrid.yearMonthKorean}
          </div>
        </div>

        {/* 7 Columns: 일~토 */}
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Weekday Header Row */}
            <div className="grid grid-cols-7 border-b-2 border-[#2F5597] bg-[#D9E1F2] text-xs font-bold text-center py-2.5">
              <div className="text-red-600">일</div>
              <div className="text-slate-800">월</div>
              <div className="text-slate-800">화</div>
              <div className="text-slate-800">수</div>
              <div className="text-slate-800">목</div>
              <div className="text-slate-800">금</div>
              <div className="text-[#0070C0]">토</div>
            </div>

            {/* Weeks */}
            {calendarGrid.weeks.map((week) => (
              <div key={week.weekIndex} className="border-b border-slate-300">
                {/* Date numbers row (행 4, 9, 14, 19, 24, 29) */}
                <div className="grid grid-cols-7 border-b border-slate-200 text-xs font-bold">
                  {week.days.map((day, idx) => {
                    const isRedDay = day.isSunday || day.isHoliday;
                    return (
                      <div
                        key={idx}
                        className={`px-2 py-1 border-r border-slate-200 last:border-r-0 flex items-center justify-between transition-colors ${
                          day.isHoliday
                            ? 'bg-rose-50 text-red-600 font-bold'
                            : day.isSunday
                            ? 'bg-red-50/50 text-red-600 font-bold'
                            : day.isSaturday
                            ? 'bg-slate-50/80 text-[#0070C0]'
                            : 'bg-slate-50/80 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold">{day.dayNumber !== null ? day.dayNumber : ''}</span>
                          {day.holidayName && (
                            <span
                              className="text-[10px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-medium truncate max-w-[85px] border border-red-200"
                              title={day.holidayName}
                            >
                              {day.holidayName}
                            </span>
                          )}
                        </div>
                        {day.hasOverflow && (
                          <span className="text-[10px] px-1 bg-amber-500 text-white rounded font-mono">
                            +{day.overflowCount}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Content Rows: 4 slots per day (행 5~8, 10~13 등) */}
                <div className="grid grid-cols-7 divide-x divide-slate-200 bg-white">
                  {week.days.map((day, colIdx) => (
                    <div key={colIdx} className="flex flex-col min-h-[96px] text-[11px]">
                      {day.dayNumber === null ? (
                        <div className="bg-slate-100/50 flex-1"></div>
                      ) : (
                        <div className="flex-1 flex flex-col justify-between p-1 space-y-1">
                          {/* Slot 0 to 3 */}
                          {[0, 1, 2, 3].map((slot) => {
                            const item = day.slots[slot];
                            if (!item) {
                              return (
                                <div
                                  key={slot}
                                  className="h-5 border-b border-dashed border-slate-100 last:border-b-0"
                                ></div>
                              );
                            }

                            return (
                              <div
                                key={slot}
                                onClick={() => {
                                  const rec = records.find((r) => r.id === item.recordId);
                                  if (rec) onSelectCandidate(rec.candidateId);
                                }}
                                className="h-5 px-1 rounded bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 flex items-center justify-center font-medium cursor-pointer transition-colors truncate shadow-2xs group"
                                title={`클릭 시 지원자 정보 확인: ${item.text}`}
                              >
                                <span
                                  className="truncate"
                                  style={{
                                    fontSize: `${item.fontSizePt || 7.5}pt`,
                                  }}
                                >
                                  {item.text}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Summary */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            {calendarGrid.yearMonthKorean} 총 확정 면접:{' '}
            <strong className="text-slate-800">{calendarGrid.totalInterviews}건</strong>
          </span>
          <span className="font-mono text-[11px]">
            * 원본 열너비(15.78), A4 가로 인쇄, FitToPage 1×1, 좌우 0.8cm 여백 설정 완료
          </span>
        </div>
      </div>
    </div>
  );
};
