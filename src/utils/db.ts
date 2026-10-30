import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  Candidate,
  InterviewRecord,
  ReportBatch,
  StoredDocument,
  TemplateProfile,
  CalendarSettings,
} from '../types';

interface RecruitDB extends DBSchema {
  candidates: {
    key: string;
    value: Candidate;
  };
  interviewRecords: {
    key: string;
    value: InterviewRecord;
    indexes: {
      by_candidate: string;
      by_batch: string;
      by_status: string;
    };
  };
  reportBatches: {
    key: string;
    value: ReportBatch;
  };
  storedDocuments: {
    key: string;
    value: StoredDocument;
    indexes: {
      by_candidate: string;
    };
  };
  templateProfiles: {
    key: string;
    value: TemplateProfile;
  };
  appSettings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'RecruitInterviewDB';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<RecruitDB>> | null = null;

export async function getDB(): Promise<IDBPDatabase<RecruitDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RecruitDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 1) {
          db.createObjectStore('candidates', { keyPath: 'id' });

          const recordStore = db.createObjectStore('interviewRecords', { keyPath: 'id' });
          recordStore.createIndex('by_candidate', 'candidateId');
          recordStore.createIndex('by_batch', 'reportBatchId');
          recordStore.createIndex('by_status', 'status');

          db.createObjectStore('reportBatches', { keyPath: 'id' });

          const docStore = db.createObjectStore('storedDocuments', { keyPath: 'id' });
          docStore.createIndex('by_candidate', 'candidateId');

          db.createObjectStore('templateProfiles', { keyPath: 'id' });
          db.createObjectStore('appSettings', { keyPath: 'key' });
        }
        // Future migrations if version upgrades
      },
    });
  }
  return dbPromise;
}

// Candidates
export async function saveCandidate(candidate: Candidate): Promise<void> {
  const db = await getDB();
  await db.put('candidates', candidate);
}

export async function getCandidate(id: string): Promise<Candidate | undefined> {
  const db = await getDB();
  return db.get('candidates', id);
}

export async function getAllCandidates(): Promise<Candidate[]> {
  const db = await getDB();
  return db.getAll('candidates');
}

// Interview Records
export async function saveInterviewRecord(record: InterviewRecord): Promise<void> {
  const db = await getDB();
  await db.put('interviewRecords', record);
}

export async function saveInterviewRecords(records: InterviewRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('interviewRecords', 'readwrite');
  for (const rec of records) {
    await tx.store.put(rec);
  }
  await tx.done;
}

export async function getInterviewRecord(id: string): Promise<InterviewRecord | undefined> {
  const db = await getDB();
  return db.get('interviewRecords', id);
}

export async function getAllInterviewRecords(): Promise<InterviewRecord[]> {
  const db = await getDB();
  return db.getAll('interviewRecords');
}

export async function deleteInterviewRecord(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('interviewRecords', id);
}

// Batches
export async function saveReportBatch(batch: ReportBatch): Promise<void> {
  const db = await getDB();
  await db.put('reportBatches', batch);
}

export async function getAllReportBatches(): Promise<ReportBatch[]> {
  const db = await getDB();
  return db.getAll('reportBatches');
}

// Documents
export async function saveDocument(doc: StoredDocument): Promise<void> {
  const db = await getDB();
  await db.put('storedDocuments', doc);
}

export async function getDocument(id: string): Promise<StoredDocument | undefined> {
  const db = await getDB();
  return db.get('storedDocuments', id);
}

export async function getAllDocuments(): Promise<StoredDocument[]> {
  const db = await getDB();
  return db.getAll('storedDocuments');
}

// Templates
export async function saveTemplateProfile(template: TemplateProfile): Promise<void> {
  const db = await getDB();
  await db.put('templateProfiles', template);
}

export async function getTemplateProfile(id: string): Promise<TemplateProfile | undefined> {
  const db = await getDB();
  return db.get('templateProfiles', id);
}

export async function getAllTemplateProfiles(): Promise<TemplateProfile[]> {
  const db = await getDB();
  return db.getAll('templateProfiles');
}

// Settings
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const item = await db.get('appSettings', key);
  return item !== undefined ? (item.value as T) : defaultValue;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('appSettings', { key, value });
}

// Checksum utility for backup verification
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// Backup & Restore
export interface BackupData {
  version: number;
  exportedAt: string;
  source: 'RecruitInterviewDB';
  checksum: string;
  candidates: Candidate[];
  interviewRecords: InterviewRecord[];
  reportBatches: ReportBatch[];
  storedDocuments: StoredDocument[];
  templateProfiles: TemplateProfile[];
  appSettings: any[];
}

export async function exportFullBackup(): Promise<string> {
  const db = await getDB();
  const candidates = await db.getAll('candidates');
  const interviewRecords = await db.getAll('interviewRecords');
  const reportBatches = await db.getAll('reportBatches');
  const storedDocuments = await db.getAll('storedDocuments');
  const templateProfiles = await db.getAll('templateProfiles');
  const appSettings = await db.getAll('appSettings');

  const payloadWithoutChecksum = {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    source: 'RecruitInterviewDB' as const,
    candidates,
    interviewRecords,
    reportBatches,
    storedDocuments,
    templateProfiles,
    appSettings,
  };

  const jsonStr = JSON.stringify(payloadWithoutChecksum);
  const checksum = simpleHash(jsonStr);

  const fullBackup: BackupData = {
    ...payloadWithoutChecksum,
    checksum,
  };

  return JSON.stringify(fullBackup, null, 2);
}

export async function inspectBackup(jsonString: string): Promise<{
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
}> {
  const parsed = JSON.parse(jsonString) as BackupData;
  if (!parsed.source || parsed.source !== 'RecruitInterviewDB' || !Array.isArray(parsed.interviewRecords)) {
    throw new Error('올바른 채용_면접 백업 파일 형식이 아닙니다.');
  }

  const { checksum, ...rest } = parsed;
  const recalculated = simpleHash(JSON.stringify(rest));
  const checksumMatched = checksum === recalculated;

  return {
    valid: true,
    version: parsed.version || 1,
    exportedAt: parsed.exportedAt || '',
    candidatesCount: parsed.candidates?.length || 0,
    recordsCount: parsed.interviewRecords?.length || 0,
    batchesCount: parsed.reportBatches?.length || 0,
    documentsCount: parsed.storedDocuments?.length || 0,
    templatesCount: parsed.templateProfiles?.length || 0,
    checksumMatched,
    data: parsed,
  };
}

export async function restoreBackup(
  backup: BackupData,
  mode: 'merge' | 'overwrite' = 'merge'
): Promise<void> {
  const db = await getDB();

  if (mode === 'overwrite') {
    await db.clear('candidates');
    await db.clear('interviewRecords');
    await db.clear('reportBatches');
    await db.clear('storedDocuments');
    await db.clear('templateProfiles');
    await db.clear('appSettings');
  }

  // Restore Candidates
  for (const c of backup.candidates || []) {
    await db.put('candidates', c);
  }

  // Restore Records
  for (const r of backup.interviewRecords || []) {
    await db.put('interviewRecords', r);
  }

  // Restore Batches
  for (const b of backup.reportBatches || []) {
    await db.put('reportBatches', b);
  }

  // Restore Documents
  for (const d of backup.storedDocuments || []) {
    await db.put('storedDocuments', d);
  }

  // Restore Templates
  for (const t of backup.templateProfiles || []) {
    await db.put('templateProfiles', t);
  }

  // Restore Settings
  for (const s of backup.appSettings || []) {
    await db.put('appSettings', s);
  }
}
