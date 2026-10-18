/**
 * Camada mínima sobre IndexedDB.
 *
 * Suporta o modo de demonstração: os dados ficam no browser, persistem entre
 * sessões e cada conta tem o seu espaço. Os volumes de um MVP são pequenos,
 * por isso leitura completa + filtro em memória é suficiente e evita
 * complexidade de índices.
 */
import { APP } from '@/config/app';

const DB_NAME = `${APP.slug}-studio`;
const DB_VERSION = 1;

export const STORES = ['accounts', 'brands', 'assets', 'blobs', 'projects'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Este browser não suporta armazenamento local.'));
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: store === 'blobs' ? undefined : 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Não foi possível abrir o armazenamento local.'));
  });

  return dbPromise;
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = action(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error('Falha ao acessar o armazenamento local.'));
      }),
  );
}

export function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  return run<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
}

export function idbGetAll<T>(store: StoreName): Promise<T[]> {
  return run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}

export function idbPut<T>(store: StoreName, value: T, key?: string): Promise<IDBValidKey> {
  return run<IDBValidKey>(store, 'readwrite', (s) =>
    key === undefined ? s.put(value) : s.put(value, key),
  );
}

export function idbDelete(store: StoreName, key: string): Promise<undefined> {
  return run<undefined>(store, 'readwrite', (s) => s.delete(key) as IDBRequest<undefined>);
}

/** Apaga tudo. Usado pela acção "limpar dados locais" nas definições. */
export async function idbClearAll(): Promise<void> {
  const db = await openDb();
  await Promise.all(
    STORES.map(
      (store) =>
        new Promise<void>((resolve, reject) => {
          const request = db.transaction(store, 'readwrite').objectStore(store).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
    ),
  );
}
