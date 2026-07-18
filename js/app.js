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
};

const elements = {
  albumGrid: document.querySelector("#album-grid"),
  albumView: document.querySelector("#album-view"),
  fileList: document.querySelector("#file-list"),
  viewTitle: document.querySelector("#view-title"),
  backButton: document.querySelector("#back-button"),
  addFileButton: document.querySelector("#add-file-button"),
  addAlbumButton: document.querySelector("#add-album-button"),
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
  storageBar: document.querySelector("#storage-bar"),
  albumPickerDialog: document.querySelector("#album-picker-dialog"),
  albumPickerList: document.querySelector("#album-picker-list"),
  createAlbumDialog: document.querySelector("#create-album-dialog"),
  createAlbumForm: document.querySelector("#create-album-form"),
  albumNameInput: document.querySelector("#album-name-input"),
  pinDialog: document.querySelector("#pin-dialog"),
  pinForm: document.querySelector("#pin-form"),
  pinInput: document.querySelector("#pin-input"),
  pinError: document.querySelector("#pin-error"),
  viewerDialog: document.querySelector("#viewer-dialog"),
  viewerTitle: document.querySelector("#viewer-title"),
  viewerBody: document.querySelector("#viewer-body"),
  viewerClose: document.querySelector("#viewer-close"),
  downloadFileButton: document.querySelector("#download-file-button"),
  deleteFileButton: document.querySelector("#delete-file-button"),
  moveFileButton: document.querySelector("#move-file-button"),
  moveDialog: document.querySelector("#move-dialog"),
  movePickerList: document.querySelector("#move-picker-list"),
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
  elements.fileInput.addEventListener("change", handleFileSelection);
  elements.createAlbumForm.addEventListener("submit", createAlbum);
  elements.backButton.addEventListener("click", handleBack);
  elements.infoButton.addEventListener("click", showVaultInfo);
  elements.vaultHomeButton.addEventListener("click", () => { location.href = "../Ghost-Phoenix/"; });
  elements.vaultSettingsButton.addEventListener("click", () => showToast("Settings will open here"));
  elements.searchInput.addEventListener("input", renderFiles);
  elements.sortSelect.addEventListener("change", renderFiles);
  elements.pinForm.addEventListener("submit", verifyPin);
  elements.viewerClose.addEventListener("click", closeViewer);
  elements.viewerDialog.addEventListener("close", () => releasePreview(elements.viewerBody));
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
  elements.heroSummary.textContent = `${state.files.length} file${state.files.length === 1 ? "" : "s"} stored`;
  elements.storageSummary.textContent = formatBytes(totalBytes);
}

function albumIcon(album) {
  if (album.id === "pinned") return "📌";
  if (album.id === "private") return "🔐";
  return "📁";
}

function renderAlbums() {
  elements.albumGrid.replaceChildren();
  elements.albumGrid.classList.remove("hidden");
  elements.albumView.classList.add("hidden");
  elements.backButton.classList.add("hidden");
  elements.viewTitle.textContent = "Your folders";

  for (const album of state.albums) {
    const count = state.files.filter(file => file.albumId === album.id).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `album-card${album.id === "private" ? " album-card--private" : ""}`;
    button.innerHTML = `
      <span class="album-card__icon" aria-hidden="true">${albumIcon(album)}</span>
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
  elements.albumGrid.classList.add("hidden");
  elements.albumView.classList.remove("hidden");
  elements.backButton.classList.remove("hidden");
  elements.searchInput.value = "";
  renderFiles();
}

function closeAlbum() {
  state.activeAlbumId = null;
  elements.pageTitle.textContent = "File Vault";
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
  alert("Ghost File Vault v0.1.3\n\nFiles are stored locally in this browser using IndexedDB. This development build is not encrypted yet.");
}

function renderFiles() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const filtered = state.files.filter(file =>
    file.albumId === state.activeAlbumId &&
    file.name.toLowerCase().includes(query)
  );
  const files = sortFiles(filtered, elements.sortSelect.value);

  elements.fileList.replaceChildren();

  if (!files.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <strong>${query ? "No matching files" : "This folder is empty"}</strong>
      <span>${query ? "Try a different search." : "Tap + File to add something."}</span>
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
      <span>
        <span class="file-card__name">${escapeHtml(file.name)}</span>
        <span class="file-card__meta">${formatBytes(file.size)} · ${formatDate(file.createdAt)}</span>
      </span>
      <span class="file-card__chevron" aria-hidden="true">›</span>
    `;
    button.addEventListener("click", () => openViewer(file.id));
    elements.fileList.append(button);
  }
}

function handleFileSelection(event) {
  const selected = [...event.target.files];
  event.target.value = "";
  if (!selected.length) return;

  state.pendingUploads = selected;
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
  });

  elements.albumPickerDialog.showModal();
}

async function savePendingUploads(albumId) {
  const uploads = state.pendingUploads;
  state.pendingUploads = [];

  for (const file of uploads) {
    await putFile({
      id: createId("file"),
      albumId,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      lastModified: file.lastModified,
      createdAt: Date.now(),
      blob: file,
    });
  }

  await refreshState();
  renderAlbums();
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

  await putAlbum({
    id: createId("album"),
    name,
    system: false,
    locked: false,
    createdAt: Date.now(),
  });

  elements.createAlbumDialog.close();
  await refreshState();
  renderAlbums();
  showToast("Folder created");
}

function renderAlbumPicker(container, selectAlbum) {
  container.replaceChildren();

  for (const album of state.albums) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "picker-button";
    button.innerHTML = `
      <span aria-hidden="true">${albumIcon(album)}</span>
      <strong>${escapeHtml(album.name)}</strong>
    `;
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
  await renderPreview(elements.viewerBody, file);
  elements.viewerDialog.showModal();
}

function closeViewer() {
  elements.viewerDialog.close();
}

function activeFile() {
  return state.files.find(file => file.id === state.activeFileId);
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
  if (!file) return;

  if (!confirm(`Delete “${file.name}” permanently?`)) return;

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

  renderAlbumPicker(elements.movePickerList, albumId => requestMoveFile(file, albumId));
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
  await putFile({ ...file, albumId });
  elements.moveDialog.close();
  elements.viewerDialog.close();
  state.activeFileId = null;
  await refreshState();
  renderFiles();
  showToast("File moved");
}

function hideApp() {
  showToast("Hide mode will open here");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character]));
}

init().catch(error => {
  console.error("Ghost Files Vault startup error:", error);
  const message = error instanceof Error && error.message
    ? error.message
    : "Ghost Files Vault could not start";
  showToast(message);
});
