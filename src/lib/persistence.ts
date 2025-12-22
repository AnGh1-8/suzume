import { openDB } from 'idb';

const DB_NAME = 'suzume-db';
const STORE_NAME = 'recent-pdfs';
const DB_VERSION = 2;

/**
 * Simple IndexedDB wrapper to persist PDF Blobs across refreshes.
 */
export async function saveFileToIdb(file: File) {
    const db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            db.createObjectStore(STORE_NAME);
        },
    });

    // Store the actual file blob using its name as key
    // We also wrap it in an object with metadata if needed
    await db.put(STORE_NAME, file, file.name);
}

export async function getFileFromIdb(name: string): Promise<File | null> {
    const db = await openDB(DB_NAME, DB_VERSION);
    return await db.get(STORE_NAME, name);
}

export async function getAllRecentNamesFromIdb(): Promise<string[]> {
    const db = await openDB(DB_NAME, DB_VERSION);
    return (await db.getAllKeys(STORE_NAME)) as string[];
}

export async function clearOldRecentFiles(keepNames: string[]) {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const allNames = await store.getAllKeys();

    for (const name of allNames) {
        if (!keepNames.includes(name as string)) {
            await store.delete(name);
        }
    }
}
