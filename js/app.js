import {
  seedSystemData,
  getAlbums,
  putAlbum,
  getFiles,
  putFile,
  deleteFile,
  getSetting,
} from "./db.js";
import { createFileCard } from "./file-card.js";
import { fileTypeLabel } from "./file-types.js";
import { renderPreview, releasePreview } from "./viewer.js";
import {
  createFolderOrderController,
  PINNED_ALBUM_ID,
  PRIVATE_ALBUM_ID,
} from "./folder-order.js";
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
  fileInput: document.querySelector("#file-input"),
  searchInput: document.querySelector("#search-input"),
  sortSelect: document.querySelector("#sort-select"),
  fileCount: document.querySelector("#file-count"),
  folderCount: document.querySelector("#folder-count"),
  heroSummary: document.querySelector("#hero-summary"),
  mainHero: document.querySelector("#main-hero"),
  mainStats: document.querySelector("#main-stats"),
  pageEyebrow: document.querySelector("#page-eyebrow"),
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
  viewerMeta: document.querySelector("#viewer-meta"),
  viewerBody: document.querySelector("#viewer-body"),
  viewerClose: document.querySelector("#viewer-close"),
  renameFileButton: document.querySelector("#rename-file-button"),
  pinFileButton: document.querySelector("#pin-file-button"),
  pinFileLabel: document.querySelector("#pin-file-label"),
  downloadFileButton: document.querySelector("#download-file-button"),
  deleteFileButton: document.querySelector("#delete-file-button"),
  moveFileButton: document.querySelector("#move-file-button"),
  renameDialog: document.querySelector("#rename-dialog"),
  renameForm: document.querySelector("#rename-form"),
  renameInput: document.querySelector("#rename-input"),
  cancelRenameButton: document.querySelector("#cancel-rename-button"),
  cancelRenameIcon: document.querySelector("#cancel-rename-icon"),
  deleteDialog: document.querySelector("#delete-dialog"),
  deleteForm: document.querySelector("#delete-form"),
  deleteFileMessage: document.querySelector("#delete-file-message"),
  cancelDeleteButton: document.querySelector("#cancel-delete-button"),
  moveDialog: document.querySelector("#move-dialog"),
  movePickerList: document.querySelector("#move-picker-list"),
  folderAddFileButton: document.querySelector("#folder-add-file-button"),
  folderSelectButton: document.querySelector("#folder-select-button"),
  hideButton: document.querySelector("#hide-button"),
};

const folderOrder = createFolderOrderController({
  grid: elements.albumGrid,
  notify: showToast,
  onOrderChange() {
    state.albums = folderOrder.sort(state.albums);
  },
  async onSaveError() {
    await refreshState();
    renderAlbums();
  },
});

async function init() {
  await seedSystemData();
  bindEvents();
  await refreshState();
  renderAlbums();
}

function bindEvents() {
  elements.addFileButton.addEventListener("click", () => elements.fileInput.click());
  elements.folderAddFileButton.addEventListener("click", () => elements.fileInput.click());
  elements.folderSelectButton.addEventListener("click", toggleSelectionMode);
  elements.addAlbumButton.addEventListener("click", openCreateAlbumDialog);
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
  elements.viewerClose.addEventListener("click", () => closeViewer());
  elements.viewerDialog.addEventListener("click", handleViewerBackdropClick);
  elements.viewerDialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeViewer();
  });
  elements.viewerDialog.addEventListener("close", handleViewerClosed);
  elements.renameFileButton.addEventListener("click", openRenameDialog);
  elements.renameForm.addEventListener("submit", renameActiveFile);
  elements.cancelRenameButton.addEventListener("click", () => elements.renameDialog.close());
  elements.cancelRenameIcon.addEventListener("click", () => elements.renameDialog.close());
  elements.pinFileButton.addEventListener("click", togglePinnedFile);
  elements.downloadFileButton.addEventListener("click", downloadActiveFile);
  elements.deleteFileButton.addEventListener("click", openDeleteDialog);
  elements.deleteForm.addEventListener("submit", removeActiveFile);
  elements.cancelDeleteButton.addEventListener("click", () => elements.deleteDialog.close());
  elements.moveFileButton.addEventListener("click", openMoveDialog);
  elements.hideButton.addEventListener("click", hideApp);
}

async function refreshState() {
  const [albums, files] = await Promise.all([getAlbums(), getFiles()]);
  state.albums = await folderOrder.prepare(albums);
  state.files = files;
  renderStorage();
}

function renderStorage() {
  const totalBytes = state.files.reduce((sum, file) => sum + file.size, 0);
  elements.fileCount.textContent = state.files.length;
  elements.folderCount.textContent = state.albums.length;
  elements.heroSummary.textContent = `${state.files.length} file${state.files.length === 1 ? "" : "s"} stored`;
  elements.storageSummary.textContent = formatBytes(totalBytes);
}

function albumArtwork(album) {
  if (album.id === PRIVATE_ALBUM_ID) {
    return '<span class="album-card__icon" aria-hidden="true">🔐</span>';
  }

  const source = album.id === PINNED_ALBUM_ID
    ? "assets/pinned-folder.jpg"
    : "assets/folder.jpg";

  return `<img class="album-card__art" src="${source}" alt="">`;
}

function renderAlbums() {
  folderOrder.cancel();
  state.selectionMode = false;
  state.selectedFileIds.clear();

  elements.albumGrid.replaceChildren();
  elements.albumGrid.classList.remove("hidden");
  elements.albumView.classList.add("hidden");
  elements.mainHero.classList.remove("hidden");
  elements.mainStats.classList.remove("hidden");
  elements.backButton.classList.add("hidden");
  elements.pageEyebrow.textContent = "GHOST";
  elements.pageTitle.textContent = "File Vault";
  elements.folderSelectButton.textContent = "Select";
  elements.folderSelectButton.setAttribute("aria-pressed", "false");
  elements.viewTitle.textContent = "Your folders";

  for (const album of state.albums) {
    elements.albumGrid.append(createAlbumCard(album));
  }
}


function createAlbumCard(album) {
  const count = state.files.filter(file => file.albumId === album.id).length;
  const reorderable = folderOrder.isReorderable(album);
  const card = document.createElement("article");

  card.className = [
    "album-card",
    album.id === PINNED_ALBUM_ID ? "album-card--pinned" : "",
    album.id === PRIVATE_ALBUM_ID ? "album-card--private" : "",
    reorderable ? "album-card--reorderable" : "album-card--fixed",
  ].filter(Boolean).join(" ");
  card.dataset.albumId = album.id;
  card.dataset.reorderable = String(reorderable);

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "album-card__open";
  openButton.setAttribute(
    "aria-label",
    `Open ${album.name} folder, ${count} file${count === 1 ? "" : "s"}`
  );
  openButton.innerHTML = `
    ${albumArtwork(album)}
    <span class="album-card__name">${escapeHtml(album.name)}</span>
    <span class="album-card__meta">${count} file${count === 1 ? "" : "s"}</span>
  `;
  openButton.addEventListener("click", () => requestOpenAlbum(album));
  card.append(openButton);

  const dragHandle = folderOrder.createHandle(card, album);
  if (dragHandle) card.append(dragHandle);

  return card;
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
  state.selectionMode = false;
  state.selectedFileIds.clear();

  const album = state.albums.find(item => item.id === albumId);
  elements.viewTitle.textContent = album?.name ?? "Folder";
  elements.pageTitle.textContent = album?.name ?? "Folder";
  elements.albumGrid.classList.add("hidden");
  elements.mainHero.classList.add("hidden");
  elements.mainStats.classList.add("hidden");
  elements.albumView.classList.remove("hidden");
  elements.backButton.classList.remove("hidden");
  elements.folderSelectButton.textContent = "Select";
  elements.folderSelectButton.setAttribute("aria-pressed", "false");
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
  alert("Ghost File Vault v0.2.7\n\nFiles are stored locally in this browser using IndexedDB. This development build is not encrypted yet.");
}

function renderFiles() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const filtered = state.files.filter(file =>
    file.albumId === state.activeAlbumId
    && file.name.toLowerCase().includes(query)
  );
  const files = sortFiles(filtered, elements.sortSelect.value);
  updateFolderSummary(files.length);

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

  const fragment = document.createDocumentFragment();

  files.forEach((file, index) => {
    const isSelected = state.selectedFileIds.has(file.id);
    const card = createFileCard(file, {
      index,
      selected: isSelected,
      selectionMode: state.selectionMode,
    });

    card.addEventListener("click", () => {
      if (state.selectionMode) {
        toggleFileSelection(file.id);
        return;
      }

      openViewer(file.id);
    });

    fragment.append(card);
  });

  elements.fileList.append(fragment);
}

function updateFolderSummary(visibleFileCount) {
  const totalInFolder = state.files.filter(file => file.albumId === state.activeAlbumId).length;
  const count = elements.searchInput.value.trim() ? visibleFileCount : totalInFolder;
  const label = count === 1 ? "FILE" : "FILES";
  elements.pageEyebrow.textContent = `${count} ${label}`;
}

function toggleSelectionMode() {
  state.selectionMode = !state.selectionMode;

  if (!state.selectionMode) {
    state.selectedFileIds.clear();
  }

  elements.folderSelectButton.textContent = state.selectionMode ? "Done" : "Select";
  elements.folderSelectButton.setAttribute("aria-pressed", String(state.selectionMode));
  renderFiles();
}

function toggleFileSelection(fileId) {
  if (state.selectedFileIds.has(fileId)) {
    state.selectedFileIds.delete(fileId);
  } else {
    state.selectedFileIds.add(fileId);
  }

  elements.folderSelectButton.textContent = state.selectedFileIds.size
    ? `${state.selectedFileIds.size} selected`
    : "Done";

  renderFiles();
}

function handleFileSelection(event) {
  const selected = [...event.target.files];
  event.target.value = "";

  if (!selected.length) return;

  if (state.activeAlbumId) {
    const album = state.albums.find(item => item.id === state.activeAlbumId);

    state.pendingUploads = selected;

    if (album?.locked) {
      state.pendingPrivateAction = () => savePendingUploads(state.activeAlbumId);
      openPinDialog();
      return;
    }

    savePendingUploads(state.activeAlbumId);
    return;
  }

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

  if (state.activeAlbumId) {
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

function albumIcon(album) {
  if (album.id === PRIVATE_ALBUM_ID) return "🔒";
  if (album.id === PINNED_ALBUM_ID) return "📌";
  return "📁";
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
  updateViewerDetails(file);

  const preview = renderPreview(elements.viewerBody, file);
  elements.viewerDialog.classList.remove("is-closing");
  elements.viewerDialog.showModal();
  requestAnimationFrame(() => elements.viewerDialog.classList.add("is-open"));

  await preview;
}

function updateViewerDetails(file) {
  elements.viewerTitle.textContent = file.name;
  elements.viewerMeta.textContent = `${fileTypeLabel(file)} • ${formatBytes(file.size)} • ${formatDate(file.createdAt)}`;
  updatePinButton(file);
}

function handleViewerBackdropClick(event) {
  if (event.target === elements.viewerDialog) {
    closeViewer();
  }
}

function handleViewerClosed() {
  elements.viewerDialog.classList.remove("is-open", "is-closing");
  releasePreview(elements.viewerBody);
  state.activeFileId = null;
}

function closeViewer() {
  return new Promise(resolve => {
    if (!elements.viewerDialog.open) {
      resolve();
      return;
    }

    if (elements.viewerDialog.classList.contains("is-closing")) {
      resolve();
      return;
    }

    elements.viewerDialog.classList.remove("is-open");
    elements.viewerDialog.classList.add("is-closing");

    window.setTimeout(() => {
      if (elements.viewerDialog.open) elements.viewerDialog.close();
      resolve();
    }, 200);
  });
}

function activeFile() {
  return state.files.find(file => file.id === state.activeFileId);
}

function selectFilenameStem(input) {
  const value = input.value;
  const extensionIndex = value.lastIndexOf(".");
  const selectionEnd = extensionIndex > 0 ? extensionIndex : value.length;
  input.setSelectionRange(0, selectionEnd);
}

function openRenameDialog() {
  const file = activeFile();
  if (!file) return;

  elements.renameInput.value = file.name;
  elements.renameDialog.showModal();

  setTimeout(() => {
    elements.renameInput.focus();
    selectFilenameStem(elements.renameInput);
  }, 50);
}

async function renameActiveFile(event) {
  event.preventDefault();

  const file = activeFile();
  const name = elements.renameInput.value.trim();
  if (!file || !name) return;

  if (name === file.name) {
    elements.renameDialog.close();
    return;
  }

  const sourceId = file.sourceFileId || file.id;
  const relatedFiles = state.files.filter(item =>
    item.id === sourceId || item.sourceFileId === sourceId
  );

  for (const relatedFile of relatedFiles) {
    await putFile({ ...relatedFile, name });
  }

  elements.renameDialog.close();
  await refreshState();

  const refreshedFile = activeFile();
  if (refreshedFile) updateViewerDetails(refreshedFile);
  renderFiles();
  showToast("File renamed");
}

function pinnedCopyFor(file) {
  const sourceId = file.sourceFileId || file.id;
  return state.files.find(item =>
    item.albumId === "pinned" &&
    (item.id === file.id || item.sourceFileId === sourceId)
  );
}

function updatePinButton(file) {
  const pinned = Boolean(pinnedCopyFor(file));
  const storedDirectlyInPinned = file.albumId === "pinned" && !file.sourceFileId;

  elements.pinFileButton.classList.toggle("is-active", pinned);
  elements.pinFileButton.disabled = storedDirectlyInPinned;
  elements.pinFileButton.setAttribute("aria-pressed", String(pinned));
  elements.pinFileLabel.textContent = storedDirectlyInPinned
    ? "Pinned"
    : pinned
      ? "Unpin"
      : "Pin";
}

async function togglePinnedFile() {
  const file = activeFile();
  if (!file) return;

  const pinnedCopy = pinnedCopyFor(file);

  if (pinnedCopy) {
    if (file.albumId === "pinned" && file.id === pinnedCopy.id) {
      if (!file.sourceFileId) {
        showToast("This file is stored directly in Pinned");
        return;
      }

      await deleteFile(file.id);
      await closeViewer();
      await refreshState();
      renderFiles();
      showToast("Removed from Pinned");
      return;
    }

    await deleteFile(pinnedCopy.id);
    await refreshState();

    const refreshedFile = activeFile();
    if (refreshedFile) updateViewerDetails(refreshedFile);
    renderFiles();
    showToast("Removed from Pinned");
    return;
  }

  await putFile({
    ...file,
    id: createId("file"),
    albumId: "pinned",
    sourceFileId: file.sourceFileId || file.id,
    sourceAlbumId: file.sourceAlbumId || file.albumId,
    createdAt: Date.now(),
  });

  await refreshState();

  const refreshedFile = activeFile();
  if (refreshedFile) updateViewerDetails(refreshedFile);
  renderFiles();
  showToast("Added to Pinned");
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

function openDeleteDialog() {
  const file = activeFile();
  if (!file) return;

  elements.deleteFileMessage.textContent = `“${file.name}” will be permanently removed from Ghost.`;
  elements.deleteDialog.showModal();
}

async function removeActiveFile(event) {
  event.preventDefault();

  const file = activeFile();
  if (!file) return;

  elements.deleteDialog.close();
  await deleteFile(file.id);
  await closeViewer();
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
  await closeViewer();
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
