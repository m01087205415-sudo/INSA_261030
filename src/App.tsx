import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header, ActiveTab } from './components/Header';
import { NewBatchTab } from './components/NewBatchTab';
import { MasterListTab } from './components/MasterListTab';
import { MonthlyCalendarTab } from './components/MonthlyCalendarTab';
import { SettingsBackupTab } from './components/SettingsBackupTab';
import {
  Candidate,
  InterviewRecord,
  ReportBatch,
  StoredDocument,
  TemplateProfile,
  CalendarSettings,
} from './types';
import {
  getAllCandidates,
  getAllInterviewRecords,
  getAllReportBatches,
  getAllDocuments,
  getAllTemplateProfiles,
  saveCandidate,
  saveInterviewRecords,
  saveReportBatch,
  saveDocument,
  saveTemplateProfile,
  deleteInterviewRecord,
  getSetting,
  setSetting,
} from './utils/db';
import { getSeoulToday, recalculateCandidateCareer } from './utils/careerCalc';
import {
  generateRecruitReportWorkbook,
  generateMonthlyCalendarWorkbook,
} from './utils/excelExporter';
import { createVirtualSampleData } from './utils/sampleData';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('new_batch');
  const [isLoading, setIsLoading] = useState(true);

  // Persistent State in IndexedDB
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [batches, setBatches] = useState<ReportBatch[]>([]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [templates, setTemplates] = useState<TemplateProfile[]>([]);

  // Calendar Settings
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings>({
    basisMonth: getSeoulToday().slice(0, 7), // e.g. 2026-10 or 2026-11
    basisMode: 'auto',
    rollingMonthCount: 12,
    timezone: 'Asia/Seoul',
  });

  // Current Working Batch (Draft)
  const [currentBatch, setCurrentBatch] = useState<ReportBatch>(() => {
    const today = getSeoulToday();
    return {
      id: `batch_${Date.now()}`,
      sheetName: `${today}_면접`,
      reportDate: today,
      recordIds: [],
      createdAt: new Date().toISOString(),
      status: 'active',
      ruleVersion: '2026.10.30_v1',
    };
  });

  const [draftCandidates, setDraftCandidates] = useState<Candidate[]>([]);
  const [draftRecords, setDraftRecords] = useState<InterviewRecord[]>([]);
  const [draftDocuments, setDraftDocuments] = useState<StoredDocument[]>([]);

  // Candidates lookup map
  const candidatesMap = useMemo(() => {
    const map = new Map<string, Candidate>();
    candidates.forEach((c) => map.set(c.id, c));
    draftCandidates.forEach((c) => map.set(c.id, c));
    return map;
  }, [candidates, draftCandidates]);

  // Section 11: ensureMonthlySheets()
  const ensureMonthlySheets = useCallback(() => {
    const todaySeoul = getSeoulToday();
    const currentMonthSeoul = todaySeoul.slice(0, 7);

    setCalendarSettings((prevSettings) => {
      if (prevSettings.basisMode === 'manual') {
        return prevSettings;
      }

      // Determine latest interview month
      let latestInterviewMonth = currentMonthSeoul;
      for (const rec of records) {
        const m = rec.interviewDateParsed?.slice(0, 7) || rec.interviewDateTime?.slice(0, 7);
        if (m && m > latestInterviewMonth) {
          latestInterviewMonth = m;
        }
      }

      // If auto, choose the later between current month and latest interview month
      const optimalBasisMonth =
        latestInterviewMonth > currentMonthSeoul ? latestInterviewMonth : currentMonthSeoul;

      if (prevSettings.basisMonth !== optimalBasisMonth) {
        return {
          ...prevSettings,
          basisMonth: optimalBasisMonth,
        };
      }
      return prevSettings;
    });
  }, [records]);

  // Load from IndexedDB on startup
  const loadDatabaseData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [cands, recs, bts, docs, tmpls] = await Promise.all([
        getAllCandidates(),
        getAllInterviewRecords(),
        getAllReportBatches(),
        getAllDocuments(),
        getAllTemplateProfiles(),
      ]);

      setCandidates(cands);
      setRecords(recs);
      setBatches(bts);
      setDocuments(docs);
      setTemplates(tmpls);

      // If DB is completely empty on very first run, populate with virtual demo sample
      if (cands.length === 0 && recs.length === 0) {
        const sample = createVirtualSampleData();
        setCurrentBatch(sample.batch);
        setDraftCandidates(sample.candidates);
        setDraftRecords(sample.records);
      }
    } catch (err) {
      console.error('Failed to load from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  // Section 11: Event triggers for ensureMonthlySheets()
  useEffect(() => {
    ensureMonthlySheets();

    // 1. Browser tab visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ensureMonthlySheets();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Midnight timer for Seoul date/month rollover
    const interval = setInterval(() => {
      ensureMonthlySheets();
    }, 60 * 1000); // Check every minute

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [ensureMonthlySheets]);

  // Save template upload
  const handleTemplateUploaded = async (template: TemplateProfile) => {
    await saveTemplateProfile(template);
    setTemplates((prev) => {
      const filtered = prev.filter((t) => t.role !== template.role);
      return [...filtered, template];
    });
  };

  // Finalize current draft batch into IndexedDB
  const handleFinalizeBatch = async () => {
    if (draftCandidates.length === 0) {
      alert('확정할 지원자 데이터가 없습니다.');
      return;
    }

    try {
      const now = new Date().toISOString();

      // Mark records as confirmed
      const confirmedRecords = draftRecords.map((r) => ({
        ...r,
        reportBatchId: currentBatch.id,
        status: 'confirmed' as const,
        confirmedAt: now,
      }));

      // Save to IndexedDB
      for (const cand of draftCandidates) {
        await saveCandidate(cand);
      }
      await saveInterviewRecords(confirmedRecords);
      for (const doc of draftDocuments) {
        await saveDocument(doc);
      }

      const batchToSave: ReportBatch = {
        ...currentBatch,
        recordIds: confirmedRecords.map((r) => r.id),
      };
      await saveReportBatch(batchToSave);

      // Update state
      setCandidates((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newOnes = draftCandidates.filter((c) => !existingIds.has(c.id));
        const updated = prev.map((c) => {
          const match = draftCandidates.find((dc) => dc.id === c.id);
          return match || c;
        });
        return [...updated, ...newOnes];
      });

      setRecords((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const newOnes = confirmedRecords.filter((r) => !existingIds.has(r.id));
        const updated = prev.map((r) => {
          const match = confirmedRecords.find((dr) => dr.id === r.id);
          return match || r;
        });
        return [...updated, ...newOnes];
      });

      setBatches((prev) => [batchToSave, ...prev]);

      // Trigger calendar sheet generation
      ensureMonthlySheets();

      // Reset draft for next batch
      const today = getSeoulToday();
      setCurrentBatch({
        id: `batch_${Date.now()}`,
        sheetName: `${today}_면접`,
        reportDate: today,
        recordIds: [],
        createdAt: new Date().toISOString(),
        status: 'active',
        ruleVersion: '2026.10.30_v1',
      });
      setDraftCandidates([]);
      setDraftRecords([]);
      setDraftDocuments([]);

      alert(
        `'${batchToSave.sheetName}' 작성 건이 확정 저장되었습니다. (종합 관리 및 월별 면접일정에 자동 반영)`
      );
      setActiveTab('master_list');
    } catch (err: any) {
      console.error(err);
      alert(`확정 저장 중 오류: ${err.message}`);
    }
  };

  // Download Recruit Report XLSX
  const handleDownloadRecruitExcel = async () => {
    try {
      ensureMonthlySheets();

      // Combine current draft records and past confirmed records
      const recordsToIncludeInDraft = draftRecords.length > 0 ? draftRecords : records;
      const allConfirmed = records.length > 0 ? records : draftRecords;

      const blob = await generateRecruitReportWorkbook({
        batch: currentBatch,
        batchRecords: recordsToIncludeInDraft,
        allConfirmedRecords: allConfirmed,
        candidatesMap,
        templateProfile: templates.find((t) => t.role === 'base'),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `경력직_면접대상자_${currentBatch.reportDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(`면접대상자 엑셀 다운로드 중 오류: ${err.message}`);
    }
  };

  // Download Monthly Calendar XLSX
  const handleDownloadCalendarExcel = async () => {
    try {
      ensureMonthlySheets();

      const allRecordsForCalendar = [
        ...records,
        ...draftRecords.filter((dr) => !records.some((r) => r.id === dr.id)),
      ];

      const blob = await generateMonthlyCalendarWorkbook({
        basisMonth: calendarSettings.basisMonth,
        allRecords: allRecordsForCalendar,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `면접일정_${calendarSettings.basisMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(`월별 면접일정 엑셀 다운로드 중 오류: ${err.message}`);
    }
  };

  // Update existing record in master list
  const handleUpdateRecordInMaster = async (
    updatedCand: Candidate,
    updatedRec: InterviewRecord
  ) => {
    await saveCandidate(updatedCand);
    await saveInterviewRecords([updatedRec]);

    setCandidates((prev) => prev.map((c) => (c.id === updatedCand.id ? updatedCand : c)));
    setRecords((prev) => prev.map((r) => (r.id === updatedRec.id ? updatedRec : r)));
    ensureMonthlySheets();
  };

  // Delete record from master list
  const handleDeleteRecordInMaster = async (recId: string) => {
    await deleteInterviewRecord(recId);
    setRecords((prev) => prev.filter((r) => r.id !== recId));
    ensureMonthlySheets();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onDownloadRecruitExcel={handleDownloadRecruitExcel}
        onDownloadCalendarExcel={handleDownloadCalendarExcel}
        hasCandidates={candidates.length > 0 || draftCandidates.length > 0}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
            데이터베이스(IndexedDB) 초기화 중...
          </div>
        ) : (
          <>
            {activeTab === 'new_batch' && (
              <NewBatchTab
                currentBatch={currentBatch}
                onUpdateBatch={setCurrentBatch}
                draftCandidates={draftCandidates}
                draftRecords={draftRecords}
                draftDocuments={draftDocuments}
                onUpdateDrafts={(c, r, d) => {
                  setDraftCandidates(c);
                  setDraftRecords(r);
                  setDraftDocuments(d);
                }}
                onFinalizeBatch={handleFinalizeBatch}
                onDownloadExcel={handleDownloadRecruitExcel}
                activeTemplate={templates.find((t) => t.role === 'base')}
              />
            )}

            {activeTab === 'master_list' && (
              <MasterListTab
                candidates={candidates}
                records={records}
                documents={documents}
                onUpdateRecord={handleUpdateRecordInMaster}
                onDeleteRecord={handleDeleteRecordInMaster}
                onDownloadExcel={handleDownloadRecruitExcel}
              />
            )}

            {activeTab === 'calendar' && (
              <MonthlyCalendarTab
                records={[
                  ...records,
                  ...draftRecords.filter((dr) => !records.some((r) => r.id === dr.id)),
                ]}
                settings={calendarSettings}
                onUpdateSettings={setCalendarSettings}
                onDownloadCalendarExcel={handleDownloadCalendarExcel}
                onSelectCandidate={(candId) => {
                  setActiveTab('master_list');
                }}
              />
            )}

            {activeTab === 'settings_backup' && (
              <SettingsBackupTab
                templates={templates}
                onTemplateUploaded={handleTemplateUploaded}
                onDataRestored={loadDatabaseData}
                candidatesCount={candidates.length}
                recordsCount={records.length}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
