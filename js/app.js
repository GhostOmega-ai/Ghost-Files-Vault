import {
  seedSystemData,
  getAlbums,
  putAlbum,
  getFiles,
  putFile,
  deleteFile,
  getSetting,
} from "./db.js";
import { fileIcon, renderPreview, releasePreview } from "./viewer.js";
import { createId, formatBytes, formatDate, showToast, sortFiles } from "./utils.js";

const state = {
  albums: [],
  files: [],
  activeAlbumId: null,
  pendingUploads: [],
  activeFileId: null,
  pendingPrivateAction: null,
  selectionMode: false,
  selectedFileIds: new Set(),
};

const elements = {
  albumGrid: document.querySelector("#album-grid"),
  albumView: document.querySelector("#album-view"),
  fileList: document.querySelector("#file-list"),
  viewTitle: document.querySelector("#view-title"),
  backButton: document.querySelector("#back-button"),
  addFileButton: document.querySelector("#add-file-button"),
  addAlbumButton: document.querySelector("#add-album-button"),
  selectFilesButton: document.querySelector("#select-files-button"),
  fileInput: document.querySelector("#file-input"),
  searchInput: document.querySelector("#search-input"),
  sortSelect: document.querySelector("#sort-select"),
  fileCount: document.querySelector("#file-count"),
  folderCount: document.querySelector("#folder-count"),
  heroSummary: document.querySelector("#hero-summary"),
  pageTitle: document.querySelector("#page-title"),
  infoButton: document.querySelector("#info-button"),
  vaultHomeButton: document.querySelector("#vault-home-button"),
  vaultSettingsButton: document.querySelector("#vault-settings-button"),
  storageSummary: document.querySelector("#storage-summary"),
  albumPickerDialog: document.querySelector("#album-picker-dialog"),
  albumPickerList: document.querySelector("#album-picker-list"),
  createAlbumDialog: document.querySelector("#create-album-dialog"),
  createAlbumForm: document.querySelector("#create-album-form"),
  albumNameInput: document.querySelector("#album-name-input"),
  cancelAlbumButton: document.querySelector("#cancel-album-button"),
  pinDialog: document.querySelector("#pin-dialog"),
  pinForm: document.querySelector("#pin-form"),
  pinInput: document.querySelector("#pin-input"),
  pinError: document.querySelector("#pin-error"),
  viewerDialog: document.querySelector("#viewer-dialog"),
  viewerTitle: document.querySelector("#viewer-title"),
  viewerBody: document.querySelector("#viewer-body"),
  viewerClose: document.querySelector("#viewer-close"),
  pinFileButton: document.querySelector("#pin-file-button"),
  renameFileButton: document.querySelector("#rename-file-button"),
  downloadFileButton: document.querySelector("#download-file-button"),
  deleteFileButton: document.querySelector("#delete-file-button"),
  moveFileButton: document.querySelector("#move-file-button"),
  moveDialog: document.querySelector("#move-dialog"),
  movePickerList: document.querySelector("#move-picker-list"),
  renameDialog: document.querySelector("#rename-dialog"),
  renameForm: document.querySelector("#rename-form"),
  renameInput: document.querySelector("#rename-input"),
  cancelRenameButton: document.querySelector("#cancel-rename-button"),
  hideButton: document.querySelector("#hide-button"),
};

async function init() {
  await seedSystemData();
  bindEvents();
  await refreshState();
  renderAlbums();
}

function bindEvents() {
  elements.addFileButton.addEventListener("click", () => elements.fileInput.click());
  elements.addAlbumButton.addEventListener("click", openCreateAlbumDialog);
  elements.selectFilesButton.addEventListener("click", toggleSelectionMode);
  elements.fileInput.addEventListener("change", handleFileSelection);
  elements.createAlbumForm.addEventListener("submit", createAlbum);
  elements.cancelAlbumButton.addEventListener("click", () => elements.createAlbumDialog.close());
  elements.backButton.addEventListener("click", handleBack);
  elements.infoButton.addEventListener("click", showVaultInfo);
  elements.vaultHomeButton.addEventListener("click", () => { location.href = "../Ghost-Phoenix/"; });
  elements.vaultSettingsButton.addEventListener("click", () => showToast("Settings will open here"));
  elements.searchInput.addEventListener("input", renderFiles);
  elements.sortSelect.addEventListener("change", renderFiles);
  elements.pinForm.addEventListener("submit", verifyPin);
  elements.viewerClose.addEventListener("click", closeViewer);
  elements.viewerDialog.addEventListener("close", () => releasePreview(elements.viewerBody));
  elements.pinFileButton.addEventListener("click", toggleActiveFilePinned);
  elements.renameFileButton.addEventListener("click", openRenameDialog);
  elements.renameForm.addEventListener("submit", renameActiveFile);
  elements.cancelRenameButton.addEventListener("click", () => elements.renameDialog.close());
  elements.downloadFileButton.addEventListener("click", downloadActiveFile);
  elements.deleteFileButton.addEventListener("click", removeActiveFile);
  elements.moveFileButton.addEventListener("click", openMoveDialog);
  elements.hideButton.addEventListener("click", hideApp);
}

async function refreshState() {
  [state.albums, state.files] = await Promise.all([getAlbums(), getFiles()]);
  state.albums.sort((a, b) => a.createdAt - b.createdAt);
  renderStorage();
}

function renderStorage() {
  const totalBytes = state.files.reduce((sum, file) => sum + file.size, 0);
  elements.fileCount.textContent = state.files.length;
  elements.folderCount.textContent = state.albums.length;
  const visibleCount = state.activeAlbumId ? filesForAlbum(state.activeAlbumId).length : state.files.length;
  elements.heroSummary.textContent = `${visibleCount} file${visibleCount === 1 ? "" : "s"}${state.activeAlbumId ? "" : " stored"}`;
  elements.storageSummary.textContent = formatBytes(totalBytes);
}

function albumArtwork(album) {
  if (album.id === "pinned") return "assets/pinned-folder.png";
  return "assets/folder.png";
}

function filesForAlbum(albumId) {
  if (albumId === "pinned") return state.files.filter(file => file.pinned === true);
  return state.files.filter(file => file.albumId === albumId);
}

function renderAlbums() {
  elements.albumGrid.replaceChildren();
  elements.albumGrid.classList.remove("hidden");
  elements.albumView.classList.add("hidden");
  elements.backButton.classList.remove("hidden");
  elements.viewTitle.textContent = "Your folders";
  elements.pageTitle.textContent = "Folders";
  elements.searchInput.parentElement.classList.add("hidden");
  elements.addAlbumButton.classList.remove("hidden");
  elements.selectFilesButton.classList.add("hidden");
  exitSelectionMode();
  renderStorage();

  for (const album of state.albums) {
    const count = filesForAlbum(album.id).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `album-card${album.id === "private" ? " album-card--private" : ""}`;

    const artwork = album.id === "private"
      ? '<span class="album-card__private-shield" aria-hidden="true"></span>'
      : `<img class="album-card__art" src="${albumArtwork(album)}" alt="" aria-hidden="true">`;

    button.innerHTML = `
      ${artwork}
      <span class="album-card__name">${escapeHtml(album.name)}</span>
      <span class="album-card__meta">${count} file${count === 1 ? "" : "s"}</span>
    `;
    button.addEventListener("click", () => requestOpenAlbum(album));
    elements.albumGrid.append(button);
  }
}

function requestOpenAlbum(album) {
  if (!album.locked) {
    openAlbum(album.id);
    return;
  }
  state.pendingPrivateAction = () => openAlbum(album.id);
  openPinDialog();
}

function openAlbum(albumId) {
  state.activeAlbumId = albumId;
  const album = state.albums.find(item => item.id === albumId);
  elements.viewTitle.textContent = album?.name ?? "Folder";
  elements.pageTitle.textContent = album?.name ?? "Folder";
  elements.searchInput.parentElement.classList.remove("hidden");
  elements.addAlbumButton.classList.add("hidden");
  elements.selectFilesButton.classList.remove("hidden");
  elements.albumGrid.classList.add("hidden");
  elements.albumView.classList.remove("hidden");
  elements.backButton.classList.remove("hidden");
  elements.searchInput.value = "";
  exitSelectionMode();
  renderStorage();
  renderFiles();
}

function closeAlbum() {
  state.activeAlbumId = null;
  elements.pageTitle.textContent = "Folders";
  renderAlbums();
}

function handleBack() {
  if (state.activeAlbumId) {
    closeAlbum();
    return;
  }
  history.back();
}

function showVaultInfo() {
  alert("Ghost File Vault v0.2\n\nFiles are stored locally in this browser using IndexedDB. This development build is not encrypted yet.");
}

function renderFiles() {
  if (!state.activeAlbumId) return;
  const query = elements.searchInput.value.trim().toLowerCase();
  const filtered = filesForAlbum(state.activeAlbumId).filter(file =>
    file.name.toLowerCase().includes(query)
  );
  const files = sortFiles(filtered, elements.sortSelect.value);
  elements.fileList.replaceChildren();

  if (!files.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state empty-state--ghost";
    empty.innerHTML = `
      <span class="empty-state__ghost" aria-hidden="true">👻</span>
      <strong>${query ? "No matching files" : "Nothing is hiding here yet"}</strong>
      <span>${query ? "Try a different search." : "Tap + File to store something safely."}</span>
    `;
    elements.fileList.append(empty);
    return;
  }

  for (const file of files) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "file-card";
    button.innerHTML = `
      <span class="file-card__icon" aria-hidden="true">${fileIcon(file)}</span>
      <span class="file-card__copy">
        <span class="file-card__name">${escapeHtml(file.name)}</span>
        <span class="file-card__meta">${formatBytes(file.size)} · ${formatDate(file.createdAt)}${file.pinned ? " · Pinned" : ""}</span>
      </span>
      <span class="file-card__chevron" aria-hidden="true">›</span>
    `;
    button.classList.toggle("is-selectable", state.selectionMode);
    button.classList.toggle("is-selected", state.selectedFileIds.has(file.id));
    button.addEventListener("click", () => {
      if (state.selectionMode) {
        toggleFileSelection(file.id);
        return;
      }
      openViewer(file.id);
    });
    elements.fileList.append(button);
  }
}

function toggleSelectionMode() {
  if (!state.activeAlbumId) return;
  state.selectionMode = !state.selectionMode;
  if (!state.selectionMode) state.selectedFileIds.clear();
  updateSelectionUi();
  renderFiles();
}

function exitSelectionMode() {
  state.selectionMode = false;
  state.selectedFileIds.clear();
  updateSelectionUi();
}

function toggleFileSelection(fileId) {
  if (state.selectedFileIds.has(fileId)) state.selectedFileIds.delete(fileId);
  else state.selectedFileIds.add(fileId);
  updateSelectionUi();
  renderFiles();
}

function updateSelectionUi() {
  if (!elements.selectFilesButton) return;
  elements.selectFilesButton.textContent = state.selectionMode ? "Cancel" : "Select";
  if (state.activeAlbumId) {
    const album = state.albums.find(item => item.id === state.activeAlbumId);
    const count = state.selectedFileIds.size;
    elements.heroSummary.textContent = state.selectionMode
      ? `${count} selected`
      : `${filesForAlbum(state.activeAlbumId).length} file${filesForAlbum(state.activeAlbumId).length === 1 ? "" : "s"}`;
    elements.pageTitle.textContent = album?.name ?? "Folder";
  }
}

function handleFileSelection(event) {
  const selected = [...event.target.files];
  event.target.value = "";
  if (!selected.length) return;

  state.pendingUploads = selected;
  if (state.activeAlbumId && state.activeAlbumId !== "pinned") {
    await savePendingUploads(state.activeAlbumId);
    return;
  }
  renderAlbumPicker(elements.albumPickerList, async albumId => {
    const album = state.albums.find(item => item.id === albumId);
    if (album?.locked) {
      state.pendingPrivateAction = () => savePendingUploads(albumId);
      elements.albumPickerDialog.close();
      openPinDialog();
      return;
    }
    await savePendingUploads(albumId);
    elements.albumPickerDialog.close();
  }, { excludePinned: true });
  elements.albumPickerDialog.showModal();
}

async function savePendingUploads(albumId) {
  const uploads = state.pendingUploads;
  state.pendingUploads = [];
  for (const file of uploads) {
    await putFile({
      id: createId("file"),
      albumId,
      pinned: false,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      lastModified: file.lastModified,
      createdAt: Date.now(),
      blob: file,
    });
  }
  await refreshState();
  if (state.activeAlbumId) {
    renderStorage();
    renderFiles();
  } else {
    renderAlbums();
  }
  showToast(`${uploads.length} file${uploads.length === 1 ? "" : "s"} added`);
}

function openCreateAlbumDialog() {
  elements.albumNameInput.value = "";
  elements.createAlbumDialog.showModal();
  setTimeout(() => elements.albumNameInput.focus(), 50);
}

async function createAlbum(event) {
  event.preventDefault();
  const name = elements.albumNameInput.value.trim();
  if (!name) return;
  if (state.albums.some(album => album.name.toLowerCase() === name.toLowerCase())) {
    showToast("A folder with that name already exists");
    return;
  }
  await putAlbum({ id: createId("album"), name, system: false, locked: false, createdAt: Date.now() });
  elements.createAlbumDialog.close();
  await refreshState();
  renderAlbums();
  showToast("Folder created");
}

function renderAlbumPicker(container, selectAlbum, options = {}) {
  container.replaceChildren();
  for (const album of state.albums) {
    if (options.excludePinned && album.id === "pinned") continue;
    if (options.excludeAlbumId && album.id === options.excludeAlbumId) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "picker-button";
    const icon = album.id === "private" ? "🔐" : "📁";
    button.innerHTML = `<span aria-hidden="true">${icon}</span><strong>${escapeHtml(album.name)}</strong>`;
    button.addEventListener("click", () => selectAlbum(album.id));
    container.append(button);
  }
}

function openPinDialog() {
  elements.pinInput.value = "";
  elements.pinError.classList.add("hidden");
  elements.pinDialog.showModal();
  setTimeout(() => elements.pinInput.focus(), 50);
}

async function verifyPin(event) {
  event.preventDefault();
  const storedPin = await getSetting("privatePin");
  if (elements.pinInput.value !== storedPin) {
    elements.pinError.classList.remove("hidden");
    elements.pinInput.select();
    return;
  }
  elements.pinDialog.close();
  const action = state.pendingPrivateAction;
  state.pendingPrivateAction = null;
  await action?.();
}

async function openViewer(fileId) {
  const file = state.files.find(item => item.id === fileId);
  if (!file) return;
  state.activeFileId = fileId;
  elements.viewerTitle.textContent = file.name;
  elements.pinFileButton.textContent = file.pinned ? "Unpin" : "Pin";
  elements.pinFileButton.classList.toggle("hidden", file.albumId === "private");
  await renderPreview(elements.viewerBody, file);
  elements.viewerDialog.showModal();
}

function closeViewer() { elements.viewerDialog.close(); }
function activeFile() { return state.files.find(file => file.id === state.activeFileId); }

async function toggleActiveFilePinned() {
  const file = activeFile();
  if (!file || file.albumId === "private") return;
  const updated = { ...file, pinned: !file.pinned };
  await putFile(updated);
  elements.pinFileButton.textContent = updated.pinned ? "Unpin" : "Pin";
  await refreshState();
  renderFiles();
  showToast(updated.pinned ? "File pinned" : "File unpinned");
}

function openRenameDialog() {
  const file = activeFile();
  if (!file) return;
  elements.renameInput.value = file.name;
  elements.renameDialog.showModal();
  setTimeout(() => {
    elements.renameInput.focus();
    elements.renameInput.select();
  }, 50);
}

async function renameActiveFile(event) {
  event.preventDefault();
  const file = activeFile();
  const name = elements.renameInput.value.trim();
  if (!file || !name) return;
  await putFile({ ...file, name });
  elements.renameDialog.close();
  elements.viewerTitle.textContent = name;
  await refreshState();
  renderFiles();
  showToast("File renamed");
}

function downloadActiveFile() {
  const file = activeFile();
  if (!file) return;
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function removeActiveFile() {
  const file = activeFile();
  if (!file || !confirm(`Delete “${file.name}” permanently?`)) return;
  await deleteFile(file.id);
  elements.viewerDialog.close();
  state.activeFileId = null;
  await refreshState();
  renderFiles();
  showToast("File deleted");
}

function openMoveDialog() {
  const file = activeFile();
  if (!file) return;
  renderAlbumPicker(elements.movePickerList, albumId => requestMoveFile(file, albumId), {
    excludePinned: true,
    excludeAlbumId: file.albumId,
  });
  elements.moveDialog.showModal();
}

function requestMoveFile(file, albumId) {
  const destination = state.albums.find(album => album.id === albumId);
  if (destination?.locked) {
    state.pendingPrivateAction = () => moveFile(file, albumId);
    elements.moveDialog.close();
    openPinDialog();
    return;
  }
  moveFile(file, albumId);
}

async function moveFile(file, albumId) {
  const movingToPrivate = albumId === "private";
  await putFile({ ...file, albumId, pinned: movingToPrivate ? false : file.pinned });
  elements.moveDialog.close();
  elements.viewerDialog.close();
  state.activeFileId = null;
  await refreshState();
  renderFiles();
  showToast(movingToPrivate ? "File moved to Private" : "File moved");
}

function hideApp() { showToast("Hide mode will open here"); }

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character]));
}

init().catch(error => {
  console.error("Ghost Files Vault startup error:", error);
  const message = error instanceof Error && error.message ? error.message : "Ghost Files Vault could not start";
  showToast(message);
});
