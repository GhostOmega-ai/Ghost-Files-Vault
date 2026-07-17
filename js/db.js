const DB_NAME = "ghost-files-vault";
const DB_VERSION = 1;
const FILE_STORE = "files";
const ALBUM_STORE = "albums";
const SETTINGS_STORE = "settings";

let databasePromise;

export function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported by this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(FILE_STORE)) {
        const files = db.createObjectStore(FILE_STORE, { keyPath: "id" });
        files.createIndex("albumId", "albumId");
        files.createIndex("createdAt", "createdAt");
        files.createIndex("name", "name");
      }

      if (!db.objectStoreNames.contains(ALBUM_STORE)) {
        const albums = db.createObjectStore(ALBUM_STORE, { keyPath: "id" });
        albums.createIndex("createdAt", "createdAt");
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      db.onversionchange = () => {
        db.close();
        databasePromise = undefined;
      };

      resolve(db);
    };

    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error ?? new Error("The Files Vault database could not be opened."));
    };

    request.onblocked = () => {
      databasePromise = undefined;
      reject(new Error("The Files Vault database is blocked by another open tab."));
    };
  });

  return databasePromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("A database request failed."));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("A database transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("A database transaction was cancelled."));
  });
}

async function runTransaction(storeName, mode, operation) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, mode);
  const completion = transactionComplete(transaction);
  const store = transaction.objectStore(storeName);

  try {
    const result = await operation(store);
    await completion;
    return result;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already have completed or aborted.
    }
    throw error;
  }
}

export async function seedSystemData() {
  const existingAlbums = await getAlbums();

  if (!existingAlbums.some(album => album.id === "pinned")) {
    await putAlbum({
      id: "pinned",
      name: "Pinned",
      system: true,
      locked: false,
      createdAt: 1,
    });
  }

  if (!existingAlbums.some(album => album.id === "private")) {
    await putAlbum({
      id: "private",
      name: "Private",
      system: true,
      locked: true,
      createdAt: 2,
    });
  }

  const pin = await getSetting("privatePin");
  if (!pin) {
    await setSetting("privatePin", "1234");
  }
}

export function getAlbums() {
  return runTransaction(ALBUM_STORE, "readonly", store =>
    requestToPromise(store.getAll())
  );
}

export function putAlbum(album) {
  return runTransaction(ALBUM_STORE, "readwrite", store =>
    requestToPromise(store.put(album))
  );
}

export function getFiles() {
  return runTransaction(FILE_STORE, "readonly", store =>
    requestToPromise(store.getAll())
  );
}

export function putFile(fileRecord) {
  return runTransaction(FILE_STORE, "readwrite", store =>
    requestToPromise(store.put(fileRecord))
  );
}

export function deleteFile(id) {
  return runTransaction(FILE_STORE, "readwrite", store =>
    requestToPromise(store.delete(id))
  );
}

export function getSetting(key) {
  return runTransaction(SETTINGS_STORE, "readonly", async store => {
    const record = await requestToPromise(store.get(key));
    return record?.value;
  });
}

export function setSetting(key, value) {
  return runTransaction(SETTINGS_STORE, "readwrite", store =>
    requestToPromise(store.put({ key, value }))
  );
}
