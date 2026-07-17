const DB_NAME = "ghost-files-vault";
const DB_VERSION = 1;
const FILE_STORE = "files";
const ALBUM_STORE = "albums";
const SETTINGS_STORE = "settings";

let databasePromise;

export function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
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

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return databasePromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(storeName, mode, operation) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await operation(store);

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return result;
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
  if (!pin) await setSetting("privatePin", "1234");
}

export function getAlbums() {
  return transaction(ALBUM_STORE, "readonly", store => requestToPromise(store.getAll()));
}

export function putAlbum(album) {
  return transaction(ALBUM_STORE, "readwrite", store => requestToPromise(store.put(album)));
}

export function getFiles() {
  return transaction(FILE_STORE, "readonly", store => requestToPromise(store.getAll()));
}

export function putFile(fileRecord) {
  return transaction(FILE_STORE, "readwrite", store => requestToPromise(store.put(fileRecord)));
}

export function deleteFile(id) {
  return transaction(FILE_STORE, "readwrite", store => requestToPromise(store.delete(id)));
}

export function getSetting(key) {
  return transaction(SETTINGS_STORE, "readonly", async store => {
    const record = await requestToPromise(store.get(key));
    return record?.value;
  });
}

export function setSetting(key, value) {
  return transaction(SETTINGS_STORE, "readwrite", store =>
    requestToPromise(store.put({ key, value }))
  );
}
