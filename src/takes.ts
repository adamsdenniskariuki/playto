import type { InstrumentId } from './types';
import type { ReferenceScore } from './songs';

export const TAKE_BYTES = 50 * 1024 * 1024;
export const TAKE_COUNT = 10;
export const TAKE_SECONDS = 300;
export interface Take {
  id: string; instrument: InstrumentId; createdAt: number; seconds: number;
  reference: ReferenceScore; blob: Blob;
}
export function evictedTakes(takes: Pick<Take, 'id' | 'createdAt' | 'blob'>[]): string[] {
  const ordered = [...takes].sort((a, b) => b.createdAt - a.createdAt);
  let bytes = 0;
  return ordered.filter((take, index) => { bytes += take.blob.size; return index >= TAKE_COUNT || bytes > TAKE_BYTES; }).map(take => take.id);
}
function openTakes(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('playto.takes', 1);
    let rejected = false;
    request.onupgradeneeded = () => request.result.createObjectStore('takes', { keyPath: 'id' });
    request.onblocked = () => { rejected = true; reject(new Error('Recording storage upgrade is blocked. Close other Playto tabs and retry.')); };
    request.onerror = () => reject(request.error ?? new Error('Recording storage could not open.'));
    request.onsuccess = () => {
      if (rejected) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
export async function readTakes(): Promise<Take[]> {
  const database = await openTakes();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('takes', 'readonly');
    const request = transaction.objectStore('takes').getAll();
    transaction.oncomplete = () => { database.close(); resolve((request.result as Take[]).sort((a, b) => b.createdAt - a.createdAt)); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Recording list could not load.')); };
  });
}
export async function storeTake(take: Take): Promise<number> {
  if (take.blob.size > TAKE_BYTES) throw new Error('Take exceeds the 50 MB recording cap. Download it instead.');
  const database = await openTakes();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('takes', 'readwrite'), store = transaction.objectStore('takes');
    let removed = 0;
    const request = store.getAll();
    request.onsuccess = () => {
      const previous = (request.result as Take[]).filter(item => item.id !== take.id);
      const evictions = evictedTakes([take, ...previous]);
      removed = evictions.length;
      evictions.forEach(id => store.delete(id));
      store.put(take);
    };
    transaction.oncomplete = () => { database.close(); resolve(removed); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Take was not saved. Recording storage may be full or unavailable.')); };
  });
}
export async function deleteTake(id: string): Promise<void> {
  const database = await openTakes();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('takes', 'readwrite');
    transaction.objectStore('takes').delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Take could not be deleted.')); };
  });
}
