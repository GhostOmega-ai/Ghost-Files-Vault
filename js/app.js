import {
  seedSystemData,
  getAlbums,
  putAlbum,
  getFiles,
  putFile,
  putFiles,
  deleteFile,
  deleteFiles,
  getSetting,
} from "./db.js";
import { createFileCard } from "./file-card.js";
import { createFileOrderController } from "./file-order.js";
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
  pendingMoveFileIds: [],
  pendingDeleteFileIds: [],
  selectionMode: false,
  selectedFileIds: new Set(),
};

const elements = {
  app: document.querySelector("#app"),
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
  deleteDialogTitle: document.querySelector("#delete-dialog-title"),
  deleteFileMessage: document.querySelector("#delete-file-message"),
  cancelDeleteButton: document.querySelector("#cancel-delete-button"),
  moveDialog: document.querySelector("#move-dialog"),
  moveDialogEyebrow: document.querySelector("#move-dialog-eyebrow"),
  moveDialogTitle: document.querySelector("#move-dialog-title"),
  movePickerList: document.querySelector("#move-picker-list"),
  folderAddFileButton: document.querySelector("#folder-add-file-button"),
  folderSelectButton: document.querySelector("#folder-select-button"),
  vaultNav: document.querySelector("#vault-nav"),
  bulkActions: document.querySelector("#bulk-actions"),
  bulkPinButton: document.querySelector("#bulk-pin-button"),
  bulkPinLabel: document.querySelector("#bulk-pin-label"),
  bulkMoveButton: document.querySelector("#bulk-move-button"),
  bulkDeleteButton: document.querySelector("#bulk-delete-button"),
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

const fileOrder = createFileOrderController({
  list: elements.fileList,
  notify: showToast,
  getFiles() {
    return state.files.filter(file => file.albumId === state.activeAlbumId);
  },
  onOrderChange(updates) {
    const replacements = new Map(updates.map(file => [file.id, file]));
    state.files = state.files.map(file => replacements.get(file.id) ?? file);
  },
  async onSaveError() {
    await refreshState();
    renderFiles();
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
  elements.folderAddFileButton.addEventListener("click", handleFolderPrimaryAction);
  elements.folderSelectButton.addEventListener("click", toggleSelectionMode);
  elements.bulkPinButton.addEventListener("click", bulkTogglePinned);
  elements.bulkMoveButton.addEventListener("click", openBulkMoveDialog);
  elements.bulkDeleteButton.addEventListener("click", openBulkDeleteDialog);
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
  elements.deleteForm.addEventListener("submit", removePendingFiles);
  elements.cancelDeleteButton.addEventListener("click", cancelPendingDelete);
  elements.moveFileButton.addEventListener("click", openMoveDialog);
  elements.hideButton.addEventListener("click", hideApp);
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !state.selectionMode) return;
    if (document.querySelector("dialog[open]")) return;
    exitSelectionMode();
  });
}

async function refreshState() {
  const [albums, files] = await Promise.all([getAlbums(), getFiles()]);
  state.albums = await folderOrder.prepare(albums);
  state.files = await fileOrder.prepare(files);
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
  fileOrder.cancel();
  resetSelectionState();

  elements.albumGrid.replaceChildren();
  elements.albumGrid.classList.remove("hidden");
  elements.albumView.classList.add("hidden");
  elements.mainHero.classList.remove("hidden");
  elements.mainStats.classList.remove("hidden");
  elements.backButton.classList.add("hidden");
  elements.pageEyebrow.textContent = "GHOST";
  elements.pageTitle.textContent = "File Vault";
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
  resetSelectionState();

  const album = state.albums.find(item => item.id === albumId);
  elements.viewTitle.textContent = album?.name ?? "Folder";
  elements.pageTitle.textContent = album?.name ?? "Folder";
  elements.albumGrid.classList.add("hidden");
  elements.mainHero.classList.add("hidden");
  elements.mainStats.classList.add("hidden");
  elements.albumView.classList.remove("hidden");
  elements.backButton.classList.remove("hidden");
  elements.searchInput.value = "";
  elements.sortSelect.value = "custom";
  renderFiles();
}

function closeAlbum() {
  fileOrder.cancel();
  resetSelectionState();
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
  alert("Ghost File Vault v0.2.8\n\nFiles are stored locally in this browser using IndexedDB. This development build is not encrypted yet.");
}

function currentFolderFiles() {
  return state.files.filter(file => file.albumId === state.activeAlbumId);
}

function visibleFiles() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const filtered = currentFolderFiles().filter(file =>
    file.name.toLowerCase().includes(query)
  );
  return sortFiles(filtered, elements.sortSelect.value);
}

function canReorderFiles(files) {
  return !state.selectionMode
    && !elements.searchInput.value.trim()
    && elements.sortSelect.value === "custom"
    && files.length > 1;
}

function renderFiles() {
  fileOrder.cancel();
  const files = visibleFiles();
  const reorderable = canReorderFiles(files);

  updateFolderSummary(files.length);
  updateSelectionUi(files);
  elements.fileList.replaceChildren();
  elements.fileList.classList.toggle("file-list--reorderable", reorderable);

  if (!files.length) {
    const query = elements.searchInput.value.trim();
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
    const selected = state.selectedFileIds.has(file.id);
    const card = createFileCard(file, {
      index,
      selected,
      selectionMode: state.selectionMode,
      reorderable,
      onActivate(event) {
        if (state.selectionMode) {
          toggleFileSelection(file.id);
          return;
        }

        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          enterSelectionMode(file.id);
          return;
        }

        openViewer(file.id);
      },
      onLongPress: state.selectionMode
        ? null
        : () => enterSelectionMode(file.id),
    });

    if (reorderable) fileOrder.bind(card, file);
    fragment.append(card);
  });

  elements.fileList.append(fragment);
}

function updateFolderSummary(visibleFileCount) {
  if (state.selectionMode) {
    const count = state.selectedFileIds.size;
    elements.pageEyebrow.textContent = `${count} SELECTED`;
    return;
  }

  const totalInFolder = currentFolderFiles().length;
  const count = elements.searchInput.value.trim() ? visibleFileCount : totalInFolder;
  const label = count === 1 ? "FILE" : "FILES";
  elements.pageEyebrow.textContent = `${count} ${label}`;
}

function resetSelectionState() {
  state.selectionMode = false;
  state.selectedFileIds.clear();
  elements.app.classList.remove("is-selecting");
  elements.folderAddFileButton.textContent = "+ File";
  elements.folderAddFileButton.disabled = false;
  elements.folderSelectButton.textContent = "Select";
  elements.folderSelectButton.setAttribute("aria-pressed", "false");
  elements.searchInput.disabled = false;
  elements.sortSelect.disabled = false;
  elements.vaultNav.classList.remove("hidden");
  elements.bulkActions.classList.add("hidden");
}

function enterSelectionMode(initialFileId = null) {
  state.selectionMode = true;
  if (initialFileId) state.selectedFileIds.add(initialFileId);
  renderFiles();
}

function exitSelectionMode({ render = true } = {}) {
  resetSelectionState();
  if (render) renderFiles();
}

function toggleSelectionMode() {
  if (state.selectionMode) {
    exitSelectionMode();
  } else {
    enterSelectionMode();
  }
}

function toggleFileSelection(fileId) {
  if (state.selectedFileIds.has(fileId)) {
    state.selectedFileIds.delete(fileId);
  } else {
    state.selectedFileIds.add(fileId);
  }
  renderFiles();
}

function handleFolderPrimaryAction() {
  if (!state.selectionMode) {
    elements.fileInput.click();
    return;
  }

  const files = visibleFiles();
  const allSelected = files.length > 0
    && files.every(file => state.selectedFileIds.has(file.id));

  if (allSelected) {
    state.selectedFileIds.clear();
  } else {
    files.forEach(file => state.selectedFileIds.add(file.id));
  }

  renderFiles();
}

function selectedFiles() {
  return visibleFiles().filter(file => state.selectedFileIds.has(file.id));
}

function updateSelectionUi(files) {
  if (!state.selectionMode) {
    elements.app.classList.remove("is-selecting");
    elements.folderAddFileButton.textContent = "+ File";
    elements.folderAddFileButton.disabled = false;
    elements.folderSelectButton.textContent = "Select";
    elements.folderSelectButton.setAttribute("aria-pressed", "false");
    elements.searchInput.disabled = false;
    elements.sortSelect.disabled = false;
    elements.vaultNav.classList.remove("hidden");
    elements.bulkActions.classList.add("hidden");
    return;
  }

  const count = state.selectedFileIds.size;
  const allVisibleSelected = files.length > 0
    && files.every(file => state.selectedFileIds.has(file.id));

  elements.app.classList.add("is-selecting");
  elements.folderAddFileButton.textContent = allVisibleSelected ? "Clear all" : "Select all";
  elements.folderAddFileButton.disabled = files.length === 0;
  elements.folderSelectButton.textContent = "Cancel";
  elements.folderSelectButton.setAttribute("aria-pressed", "true");
  elements.searchInput.disabled = true;
  elements.sortSelect.disabled = true;
  elements.vaultNav.classList.add("hidden");
  elements.bulkActions.classList.remove("hidden");
  elements.bulkMoveButton.disabled = count === 0;
  elements.bulkDeleteButton.disabled = count === 0;
  updateBulkPinButton(selectedFiles());
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
  const orders = fileOrder.prependOrders(state.files, albumId, uploads.length);
  const timestamp = Date.now();
  const records = uploads.map((file, index) => ({
    id: createId("file"),
    albumId,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    lastModified: file.lastModified,
    createdAt: timestamp + index,
    fileOrder: orders[index],
    blob: file,
  }));

  await putFiles(records);
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

function renderAlbumPicker(container, selectAlbum, options = {}) {
  const disabledAlbumIds = new Set(options.disabledAlbumIds ?? []);
  container.replaceChildren();

  for (const album of state.albums) {
    const disabled = disabledAlbumIds.has(album.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "picker-button";
    button.disabled = disabled;
    button.innerHTML = `
      <span aria-hidden="true">${albumIcon(album)}</span>
      <strong>${escapeHtml(album.name)}</strong>
      ${disabled ? '<span class="picker-button__note">Current</span>' : ""}
    `;
    if (!disabled) button.addEventListener("click", () => selectAlbum(album.id));
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
  const relatedFiles = state.files
    .filter(item => item.id === sourceId || item.sourceFileId === sourceId)
    .map(item => ({ ...item, name }));

  await putFiles(relatedFiles);
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
    item.albumId === PINNED_ALBUM_ID
    && (item.id === file.id || item.sourceFileId === sourceId)
  );
}

function isDirectPinnedFile(file) {
  return file.albumId === PINNED_ALBUM_ID && !file.sourceFileId;
}

function isFilePinned(file) {
  return isDirectPinnedFile(file) || Boolean(pinnedCopyFor(file));
}

function removablePinnedCopyFor(file) {
  if (isDirectPinnedFile(file)) return null;
  if (file.albumId === PINNED_ALBUM_ID && file.sourceFileId) return file;
  return pinnedCopyFor(file) ?? null;
}

function updatePinButton(file) {
  const pinned = isFilePinned(file);
  const storedDirectlyInPinned = isDirectPinnedFile(file);

  elements.pinFileButton.classList.toggle("is-active", pinned);
  elements.pinFileButton.disabled = storedDirectlyInPinned;
  elements.pinFileButton.setAttribute("aria-pressed", String(pinned));
  elements.pinFileLabel.textContent = storedDirectlyInPinned
    ? "Pinned"
    : pinned
      ? "Unpin"
      : "Pin";
}

function updateBulkPinButton(files) {
  const allPinned = files.length > 0 && files.every(isFilePinned);
  const removable = files.some(file => Boolean(removablePinnedCopyFor(file)));
  const allDirect = files.length > 0 && files.every(isDirectPinnedFile);

  if (allDirect) {
    elements.bulkPinButton.dataset.mode = "none";
    elements.bulkPinLabel.textContent = "Pinned";
    elements.bulkPinButton.disabled = true;
    return;
  }

  const mode = allPinned && removable ? "unpin" : "pin";
  elements.bulkPinButton.dataset.mode = mode;
  elements.bulkPinLabel.textContent = mode === "unpin" ? "Unpin" : "Pin";
  elements.bulkPinButton.disabled = files.length === 0
    || (mode === "pin" && files.every(isFilePinned));
}

async function togglePinnedFile() {
  const file = activeFile();
  if (!file) return;

  const pinnedCopy = removablePinnedCopyFor(file);

  if (pinnedCopy) {
    await deleteFile(pinnedCopy.id);

    if (file.id === pinnedCopy.id) {
      await closeViewer();
    }

    await refreshState();
    const refreshedFile = activeFile();
    if (refreshedFile) updateViewerDetails(refreshedFile);
    renderFiles();
    showToast("Removed from Pinned");
    return;
  }

  if (isDirectPinnedFile(file)) {
    showToast("This file is stored directly in Pinned");
    return;
  }

  const [fileOrderValue] = fileOrder.prependOrders(state.files, PINNED_ALBUM_ID, 1);
  await putFile({
    ...file,
    id: createId("file"),
    albumId: PINNED_ALBUM_ID,
    sourceFileId: file.sourceFileId || file.id,
    sourceAlbumId: file.sourceAlbumId || file.albumId,
    createdAt: Date.now(),
    fileOrder: fileOrderValue,
  });

  await refreshState();
  const refreshedFile = activeFile();
  if (refreshedFile) updateViewerDetails(refreshedFile);
  renderFiles();
  showToast("Added to Pinned");
}

async function bulkTogglePinned() {
  const files = selectedFiles();
  if (!files.length) return;

  const mode = elements.bulkPinButton.dataset.mode;

  if (mode === "unpin") {
    const ids = [...new Set(
      files.map(removablePinnedCopyFor).filter(Boolean).map(file => file.id)
    )];
    if (!ids.length) return;

    await deleteFiles(ids);
    await refreshState();
    exitSelectionMode({ render: false });
    renderFiles();
    showToast(`${ids.length} file${ids.length === 1 ? "" : "s"} removed from Pinned`);
    return;
  }

  const filesToPin = files.filter(file => !isFilePinned(file));
  if (!filesToPin.length) return;

  const orders = fileOrder.prependOrders(
    state.files,
    PINNED_ALBUM_ID,
    filesToPin.length
  );
  const timestamp = Date.now();
  const copies = filesToPin.map((file, index) => ({
    ...file,
    id: createId("file"),
    albumId: PINNED_ALBUM_ID,
    sourceFileId: file.sourceFileId || file.id,
    sourceAlbumId: file.sourceAlbumId || file.albumId,
    createdAt: timestamp + index,
    fileOrder: orders[index],
  }));

  await putFiles(copies);
  await refreshState();
  exitSelectionMode({ render: false });
  renderFiles();
  showToast(`${copies.length} file${copies.length === 1 ? "" : "s"} added to Pinned`);
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
  openDeleteDialogFor([file.id]);
}

function openBulkDeleteDialog() {
  const ids = selectedFiles().map(file => file.id);
  if (!ids.length) return;
  openDeleteDialogFor(ids);
}

function openDeleteDialogFor(fileIds) {
  state.pendingDeleteFileIds = [...new Set(fileIds)];
  const files = state.pendingDeleteFileIds
    .map(id => state.files.find(file => file.id === id))
    .filter(Boolean);
  if (!files.length) return;

  if (files.length === 1) {
    elements.deleteDialogTitle.textContent = "Delete this file?";
    elements.deleteFileMessage.textContent = `“${files[0].name}” will be permanently removed from Ghost.`;
  } else {
    elements.deleteDialogTitle.textContent = `Delete ${files.length} files?`;
    elements.deleteFileMessage.textContent = "The selected files will be permanently removed from Ghost.";
  }

  elements.deleteDialog.showModal();
}

function cancelPendingDelete() {
  state.pendingDeleteFileIds = [];
  elements.deleteDialog.close();
}

async function removePendingFiles(event) {
  event.preventDefault();

  const requestedFiles = state.pendingDeleteFileIds
    .map(id => state.files.find(file => file.id === id))
    .filter(Boolean);
  if (!requestedFiles.length) return;

  const ids = new Set();
  for (const file of requestedFiles) {
    ids.add(file.id);
    if (!file.sourceFileId) {
      state.files
        .filter(item => item.sourceFileId === file.id)
        .forEach(item => ids.add(item.id));
    }
  }

  state.pendingDeleteFileIds = [];
  elements.deleteDialog.close();
  await deleteFiles([...ids]);

  if (elements.viewerDialog.open) await closeViewer();
  await refreshState();
  exitSelectionMode({ render: false });
  renderFiles();
  showToast(`${requestedFiles.length} file${requestedFiles.length === 1 ? "" : "s"} deleted`);
}

function openMoveDialog() {
  const file = activeFile();
  if (!file) return;
  openMoveDialogFor([file.id]);
}

function openBulkMoveDialog() {
  const ids = selectedFiles().map(file => file.id);
  if (!ids.length) return;
  openMoveDialogFor(ids);
}

function openMoveDialogFor(fileIds) {
  state.pendingMoveFileIds = [...new Set(fileIds)];
  const count = state.pendingMoveFileIds.length;
  if (!count) return;

  elements.moveDialogEyebrow.textContent = count === 1 ? "MOVE FILE" : `MOVE ${count} FILES`;
  elements.moveDialogTitle.textContent = "Choose a folder";
  renderAlbumPicker(
    elements.movePickerList,
    albumId => requestMoveFiles(state.pendingMoveFileIds, albumId),
    { disabledAlbumIds: [state.activeAlbumId] }
  );
  elements.moveDialog.showModal();
}

function requestMoveFiles(fileIds, albumId) {
  const destination = state.albums.find(album => album.id === albumId);

  if (destination?.locked) {
    state.pendingPrivateAction = () => moveFiles(fileIds, albumId);
    elements.moveDialog.close();
    openPinDialog();
    return;
  }

  moveFiles(fileIds, albumId);
}

function movedFileRecord(file, albumId, fileOrderValue) {
  const updated = { ...file, albumId, fileOrder: fileOrderValue };

  if (file.albumId === PINNED_ALBUM_ID
    && file.sourceFileId
    && albumId !== PINNED_ALBUM_ID) {
    delete updated.sourceFileId;
    delete updated.sourceAlbumId;
  }

  return updated;
}

async function moveFiles(fileIds, albumId) {
  const files = fileIds
    .map(id => state.files.find(file => file.id === id))
    .filter(file => file && file.albumId !== albumId);
  if (!files.length) {
    elements.moveDialog.close();
    return;
  }

  const orders = fileOrder.prependOrders(state.files, albumId, files.length);
  const updates = new Map();

  files.forEach((file, index) => {
    updates.set(file.id, movedFileRecord(file, albumId, orders[index]));

    if (!file.sourceFileId) {
      state.files
        .filter(item => item.sourceFileId === file.id)
        .forEach(copy => updates.set(copy.id, { ...copy, sourceAlbumId: albumId }));
    }
  });

  await putFiles([...updates.values()]);
  state.pendingMoveFileIds = [];
  elements.moveDialog.close();
  if (elements.viewerDialog.open) await closeViewer();
  await refreshState();
  exitSelectionMode({ render: false });
  renderFiles();
  showToast(`${files.length} file${files.length === 1 ? "" : "s"} moved`);
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
