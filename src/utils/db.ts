import { FileInput } from '../../types';

const DB_NAME = 'SmartStudyDB';
const DB_VERSION = 1;
const STORE_NAME = 'subjectFiles';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'subjectId' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error || new Error('Failed to open database'));
    };
  });
}

export interface SubjectFilesRecord {
  subjectId: string;
  files: FileInput[];
  syllabusFiles: FileInput[];
  previousPapers: FileInput[];
}

export async function saveSubjectFiles(
  subjectId: string,
  files: FileInput[],
  syllabusFiles: FileInput[],
  previousPapers: FileInput[]
): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record: SubjectFilesRecord = {
        subjectId,
        files,
        syllabusFiles,
        previousPapers,
      };

      const request = store.put(record);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event: any) => {
        reject(event.target.error || new Error('Failed to write record'));
      };
    });
  } catch (err) {
    console.error('IndexedDB Save Error:', err);
    throw err;
  }
}

export async function getSubjectFiles(subjectId: string): Promise<SubjectFilesRecord | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(subjectId);

      request.onsuccess = (event: any) => {
        resolve(event.target.result || null);
      };

      request.onerror = (event: any) => {
        reject(event.target.error || new Error('Failed to retrieve record'));
      };
    });
  } catch (err) {
    console.error('IndexedDB Get Error:', err);
    return null;
  }
}

export async function deleteSubjectFiles(subjectId: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(subjectId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event: any) => {
        reject(event.target.error || new Error('Failed to delete record'));
      };
    });
  } catch (err) {
    console.error('IndexedDB Delete Error:', err);
  }
}
