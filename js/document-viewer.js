import { extensionOf } from "./file-types.js";

const LIBRARY_URLS = Object.freeze({
  pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs",
  pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs",
  mammoth: "https://unpkg.com/mammoth@1.10.0/mammoth.browser.min.js",
  xlsx: "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js",
  jszip: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  marked: "https://cdn.jsdelivr.net/npm/marked@18.0.5/lib/marked.umd.min.js",
  dompurify: "https://unpkg.com/dompurify@3.4.11/dist/purify.min.js",
});

const TEXT_EXTENSIONS = new Set([
  "txt", "log", "ini", "conf", "cfg", "properties", "env",
  "css", "js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "java",
  "c", "cpp", "h", "hpp", "cs", "php", "rb", "go", "rs", "swift",
  "kt", "kts", "sql", "sh", "bat", "ps1", "vue", "svelte",
  "yaml", "yml", "toml", "xml", "html", "htm", "svg",
]);
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdown", "mkd"]);
const SPREADSHEET_EXTENSIONS = new Set([
  "xlsx", "xls", "xlsb", "xlsm", "ods", "numbers", "csv", "tsv", "dif", "sylk",
]);
const WORD_EXTENSIONS = new Set(["docx", "docm"]);
const LEGACY_WORD_EXTENSIONS = new Set(["doc"]);
const PRESENTATION_EXTENSIONS = new Set(["pptx", "pptm", "odp"]);
const LEGACY_PRESENTATION_EXTENSIONS = new Set(["ppt"]);
const OPEN_DOCUMENT_TEXT_EXTENSIONS = new Set(["odt", "fodt"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "epub"]);

const controllerMap = new WeakMap();
const scriptPromises = new Map();
let pdfModulePromise;


function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent !== undefined) element.textContent = textContent;
  return element;
}

function iconButton(label, pathData) {
  const button = createElement("button", "document-control");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      ${pathData}
    </svg>
  `;
  return button;
}

function setController(container, controller) {
  controllerMap.set(container, controller);
}

function loadClassicScript(key, url, globalName) {
  if (globalThis[globalName]) return Promise.resolve(globalThis[globalName]);
  if (scriptPromises.has(key)) return scriptPromises.get(key);

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-ghost-library="${key}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(globalThis[globalName]), { once: true });
      existing.addEventListener("error", () => reject(new Error(`${key} could not load`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.ghostLibrary = key;
    script.addEventListener("load", () => {
      const library = globalThis[globalName];
      if (!library) {
        reject(new Error(`${key} loaded without exposing ${globalName}`));
        return;
      }
      resolve(library);
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`${key} could not load`)), { once: true });
    document.head.append(script);
  }).catch(error => {
    scriptPromises.delete(key);
    throw error;
  });

  scriptPromises.set(key, promise);
  return promise;
}

async function loadPdfModule() {
  if (!pdfModulePromise) {
    pdfModulePromise = import(LIBRARY_URLS.pdf)
      .then(module => {
        module.GlobalWorkerOptions.workerSrc = LIBRARY_URLS.pdfWorker;
        return module;
      })
      .catch(error => {
        pdfModulePromise = undefined;
        throw error;
      });
  }
  return pdfModulePromise;
}

function loadMammoth() {
  return loadClassicScript("mammoth", LIBRARY_URLS.mammoth, "mammoth");
}

function loadSheetJs() {
  return loadClassicScript("sheetjs", LIBRARY_URLS.xlsx, "XLSX");
}

function loadJsZip() {
  return loadClassicScript("jszip", LIBRARY_URLS.jszip, "JSZip");
}

function loadMarked() {
  return loadClassicScript("marked", LIBRARY_URLS.marked, "marked");
}

function loadDomPurify() {
  return loadClassicScript("dompurify", LIBRARY_URLS.dompurify, "DOMPurify");
}

function createLoadingView(container, label = "Opening document") {
  container.dataset.previewKind = "document-loading";
  const loading = createElement("div", "document-loading");
  loading.innerHTML = `
    <span class="document-loading__orb" aria-hidden="true"></span>
    <strong>${label}</strong>
    <span>Ghost is preparing a secure local preview…</span>
  `;
  container.replaceChildren(loading);
  return loading;
}

function createDocumentShell(container, kind, label) {
  container.dataset.previewKind = kind;
  const shell = createElement("section", `document-viewer document-viewer--${kind}`);
  shell.setAttribute("aria-label", label);

  const toolbar = createElement("div", "document-viewer__toolbar");
  const viewport = createElement("div", "document-viewer__viewport");
  const status = createElement("div", "document-viewer__status");
  status.setAttribute("aria-live", "polite");

  shell.append(toolbar, viewport, status);
  container.replaceChildren(shell);
  return { shell, toolbar, viewport, status };
}

function showStatus(status, message, timeout = 1800) {
  status.textContent = message;
  status.classList.add("is-visible");
  const timer = window.setTimeout(() => status.classList.remove("is-visible"), timeout);
  return () => window.clearTimeout(timer);
}

async function renderError(container, fileRecord, error, title = "Ghost could not format this document") {
  console.error("Ghost document viewer error:", error);
  await renderBinaryDocument(container, fileRecord, {
    title,
    detail: "Ghost opened the file in safe inspection mode so it is still readable and manageable.",
  });
}

export async function renderDocumentPreview(container, fileRecord) {
  releaseDocumentPreview(container);
  createLoadingView(container);

  const type = fileRecord.type || "";
  const extension = extensionOf(fileRecord.name);

  try {
    if (type === "application/pdf" || extension === "pdf") {
      await renderPdfDocument(container, fileRecord);
      return;
    }

    if (WORD_EXTENSIONS.has(extension)) {
      await renderWordDocument(container, fileRecord);
      return;
    }

    if (SPREADSHEET_EXTENSIONS.has(extension)) {
      await renderSpreadsheetDocument(container, fileRecord);
      return;
    }

    if (PRESENTATION_EXTENSIONS.has(extension)) {
      await renderPresentationDocument(container, fileRecord);
      return;
    }

    if (OPEN_DOCUMENT_TEXT_EXTENSIONS.has(extension)) {
      await renderOpenDocumentText(container, fileRecord);
      return;
    }

    if (extension === "rtf" || type === "application/rtf" || type === "text/rtf") {
      await renderRtfDocument(container, fileRecord);
      return;
    }

    if (MARKDOWN_EXTENSIONS.has(extension)) {
      await renderMarkdownDocument(container, fileRecord);
      return;
    }

    if (extension === "json" || type === "application/json") {
      await renderJsonDocument(container, fileRecord);
      return;
    }

    if (extension === "html" || extension === "htm" || type === "text/html") {
      await renderHtmlDocument(container, fileRecord);
      return;
    }

    if (extension === "xml" || type.includes("xml")) {
      await renderXmlDocument(container, fileRecord);
      return;
    }

    if (ARCHIVE_EXTENSIONS.has(extension)) {
      await renderArchiveDocument(container, fileRecord);
      return;
    }

    if (TEXT_EXTENSIONS.has(extension) || type.startsWith("text/")) {
      await renderTextDocument(container, fileRecord);
      return;
    }

    if (LEGACY_WORD_EXTENSIONS.has(extension) || LEGACY_PRESENTATION_EXTENSIONS.has(extension)) {
      await renderLegacyOfficeDocument(container, fileRecord);
      return;
    }

    await renderBinaryDocument(container, fileRecord);
  } catch (error) {
    await renderError(container, fileRecord, error);
  }
}

async function renderPdfDocument(container, fileRecord) {
  const pdfjs = await loadPdfModule();
  const { toolbar, viewport, status } = createDocumentShell(container, "pdf", fileRecord.name);
  const abortController = new AbortController();
  const { signal } = abortController;

  const previous = iconButton("Previous page", '<path d="m15 18-6-6 6-6"/>');
  const next = iconButton("Next page", '<path d="m9 18 6-6-6-6"/>');
  const zoomOut = iconButton("Zoom out", '<path d="M5 12h14"/>');
  const zoomIn = iconButton("Zoom in", '<path d="M12 5v14M5 12h14"/>');
  const fit = iconButton("Fit page", '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>');
  const pageLabel = createElement("span", "document-page-label", "1 / 1");
  const zoomLabel = createElement("span", "document-zoom-label", "100%");

  const pageGroup = createElement("div", "document-control-group");
  pageGroup.append(previous, pageLabel, next);
  const zoomGroup = createElement("div", "document-control-group");
  zoomGroup.append(zoomOut, zoomLabel, zoomIn, fit);
  toolbar.append(pageGroup, zoomGroup);

  const canvasWrap = createElement("div", "pdf-canvas-wrap");
  const canvas = createElement("canvas", "pdf-canvas");
  canvasWrap.append(canvas);
  viewport.append(canvasWrap);

  const data = new Uint8Array(await fileRecord.blob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  let pageNumber = 1;
  let scale = 1;
  let fitMode = true;
  let renderTask = null;
  let destroyed = false;

  async function renderPage() {
    if (destroyed) return;
    renderTask?.cancel();

    const page = await pdf.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(280, viewport.clientWidth - 42);
    const availableHeight = Math.max(260, viewport.clientHeight - 42);
    const fitScale = Math.min(
      availableWidth / unscaledViewport.width,
      availableHeight / unscaledViewport.height
    );
    const requestedScale = fitMode ? fitScale : scale;
    scale = clamp(requestedScale, .35, 4);

    const pageViewport = page.getViewport({ scale });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(pageViewport.width * pixelRatio);
    canvas.height = Math.floor(pageViewport.height * pixelRatio);
    canvas.style.width = `${Math.floor(pageViewport.width)}px`;
    canvas.style.height = `${Math.floor(pageViewport.height)}px`;

    const context = canvas.getContext("2d", { alpha: false });
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    renderTask = page.render({
      canvasContext: context,
      viewport: pageViewport,
      transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
    });
    try {
      await renderTask.promise;
    } catch (error) {
      if (error?.name !== "RenderingCancelledException") throw error;
    }

    pageLabel.textContent = `${pageNumber} / ${pdf.numPages}`;
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    previous.disabled = pageNumber <= 1;
    next.disabled = pageNumber >= pdf.numPages;
    canvas.classList.add("is-ready");
  }

  previous.addEventListener("click", () => {
    if (pageNumber <= 1) return;
    pageNumber -= 1;
    renderPage();
  }, { signal });

  next.addEventListener("click", () => {
    if (pageNumber >= pdf.numPages) return;
    pageNumber += 1;
    renderPage();
  }, { signal });

  zoomOut.addEventListener("click", () => {
    fitMode = false;
    scale = clamp(scale / 1.2, .35, 4);
    renderPage();
  }, { signal });

  zoomIn.addEventListener("click", () => {
    fitMode = false;
    scale = clamp(scale * 1.2, .35, 4);
    renderPage();
  }, { signal });

  fit.addEventListener("click", () => {
    fitMode = true;
    renderPage();
    showStatus(status, "Page fitted to the viewer");
  }, { signal });

  viewport.addEventListener("wheel", event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    fitMode = false;
    scale = clamp(scale * Math.exp(-event.deltaY * .0015), .35, 4);
    renderPage();
  }, { passive: false, signal });

  viewport.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" || event.key === "PageUp") previous.click();
    if (event.key === "ArrowRight" || event.key === "PageDown") next.click();
    if (["+", "="].includes(event.key)) zoomIn.click();
    if (["-", "_"].includes(event.key)) zoomOut.click();
    if (event.key === "0") fit.click();
  }, { signal });
  viewport.tabIndex = 0;

  const resizeObserver = new ResizeObserver(() => {
    if (fitMode) renderPage();
  });
  resizeObserver.observe(viewport);

  setController(container, {
    destroy() {
      destroyed = true;
      renderTask?.cancel();
      loadingTask.destroy();
      pdf.destroy();
      resizeObserver.disconnect();
      abortController.abort();
    },
  });

  await renderPage();
}

async function renderWordDocument(container, fileRecord) {
  const [mammoth, DOMPurify] = await Promise.all([loadMammoth(), loadDomPurify()]);
  const { toolbar, viewport, status } = createDocumentShell(container, "word", fileRecord.name);
  const result = await mammoth.convertToHtml(
    { arrayBuffer: await fileRecord.blob.arrayBuffer() },
    {
      styleMap: [
        "p[style-name='Title'] => h1.document-title:fresh",
        "p[style-name='Subtitle'] => p.document-subtitle:fresh",
      ],
      includeDefaultStyleMap: true,
    }
  );

  const safeHtml = DOMPurify.sanitize(result.value, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
  });

  const sheet = createElement("article", "document-sheet document-sheet--word");
  sheet.innerHTML = safeHtml || "<p>This Word document contains no readable text.</p>";
  prepareDocumentLinks(sheet);
  viewport.append(sheet);
  attachDocumentZoom(toolbar, viewport, sheet, status, container);

  if (result.messages?.length) {
    console.info("Ghost Word preview messages:", result.messages);
  }
}

async function renderSpreadsheetDocument(container, fileRecord) {
  const XLSX = await loadSheetJs();
  const { toolbar, viewport, status } = createDocumentShell(container, "sheet", fileRecord.name);
  const workbook = XLSX.read(await fileRecord.blob.arrayBuffer(), {
    type: "array",
    cellDates: true,
    cellText: true,
  });

  const tabs = createElement("div", "sheet-tabs");
  const tableWrap = createElement("div", "spreadsheet-wrap");
  viewport.append(tableWrap);
  toolbar.append(tabs);

  let activeSheetName = workbook.SheetNames[0];

  function renderSheet(sheetName) {
    activeSheetName = sheetName;
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: true,
    });

    const maxRows = Math.min(rows.length, 1000);
    const maxColumns = Math.min(
      100,
      rows.reduce((maximum, row) => Math.max(maximum, row.length), 0)
    );

    const table = createElement("table", "spreadsheet-table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.append(createElement("th", "spreadsheet-corner", ""));
    for (let column = 0; column < maxColumns; column += 1) {
      headRow.append(createElement("th", "", columnName(column)));
    }
    head.append(headRow);
    table.append(head);

    const body = document.createElement("tbody");
    for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
      const rowElement = document.createElement("tr");
      rowElement.append(createElement("th", "spreadsheet-row-number", String(rowIndex + 1)));
      const row = rows[rowIndex] || [];
      for (let column = 0; column < maxColumns; column += 1) {
        rowElement.append(createElement("td", "", String(row[column] ?? "")));
      }
      body.append(rowElement);
    }
    table.append(body);
    tableWrap.replaceChildren(table);

    for (const button of tabs.querySelectorAll("button")) {
      button.classList.toggle("is-active", button.dataset.sheet === sheetName);
    }

    if (rows.length > maxRows || rows.some(row => row.length > maxColumns)) {
      showStatus(status, `Showing the first ${maxRows} rows and ${maxColumns} columns`, 3200);
    }
  }

  for (const sheetName of workbook.SheetNames) {
    const button = createElement("button", "sheet-tab", sheetName);
    button.type = "button";
    button.dataset.sheet = sheetName;
    button.addEventListener("click", () => renderSheet(sheetName));
    tabs.append(button);
  }

  if (!activeSheetName) {
    tableWrap.append(createElement("div", "document-empty", "This workbook contains no sheets."));
    return;
  }
  renderSheet(activeSheetName);
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

async function renderPresentationDocument(container, fileRecord) {
  const JSZip = await loadJsZip();
  const extension = extensionOf(fileRecord.name);
  const zip = await JSZip.loadAsync(await fileRecord.blob.arrayBuffer());

  if (extension === "odp") {
    await renderOdpPresentation(container, fileRecord, zip);
    return;
  }

  const slideNames = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort(naturalSort);

  const slides = [];
  for (const slideName of slideNames) {
    const xml = await zip.file(slideName).async("text");
    const documentXml = new DOMParser().parseFromString(xml, "application/xml");
    const textNodes = [...documentXml.getElementsByTagNameNS("*", "t")];
    const text = textNodes.map(node => node.textContent?.trim()).filter(Boolean);
    slides.push(text);
  }

  renderSlideDeck(container, fileRecord, slides);
}

async function renderOdpPresentation(container, fileRecord, zip) {
  const content = zip.file("content.xml");
  if (!content) throw new Error("The ODP document has no content.xml file");
  const xml = await content.async("text");
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  const pages = [...documentXml.getElementsByTagNameNS("*", "page")];
  const slides = pages.map(page => {
    const nodes = [
      ...page.getElementsByTagNameNS("*", "h"),
      ...page.getElementsByTagNameNS("*", "p"),
    ];
    return nodes.map(node => node.textContent?.trim()).filter(Boolean);
  });
  renderSlideDeck(container, fileRecord, slides);
}

function renderSlideDeck(container, fileRecord, slides) {
  const { toolbar, viewport, status } = createDocumentShell(container, "slides", fileRecord.name);
  const previous = iconButton("Previous slide", '<path d="m15 18-6-6 6-6"/>');
  const next = iconButton("Next slide", '<path d="m9 18 6-6-6-6"/>');
  const label = createElement("span", "document-page-label", "1 / 1");
  const group = createElement("div", "document-control-group");
  group.append(previous, label, next);
  toolbar.append(group);

  let index = 0;
  function renderSlide() {
    const slide = createElement("article", "presentation-slide");
    slide.append(createElement("span", "presentation-slide__number", `SLIDE ${index + 1}`));
    const content = createElement("div", "presentation-slide__content");
    const lines = slides[index] || [];
    if (lines.length) {
      lines.forEach((line, lineIndex) => {
        content.append(createElement(lineIndex === 0 ? "h2" : "p", "", line));
      });
    } else {
      content.append(createElement("p", "document-muted", "This slide contains no extractable text."));
    }
    slide.append(content);
    viewport.replaceChildren(slide);
    label.textContent = `${index + 1} / ${Math.max(slides.length, 1)}`;
    previous.disabled = index <= 0;
    next.disabled = index >= slides.length - 1;
  }

  previous.addEventListener("click", () => {
    if (index <= 0) return;
    index -= 1;
    renderSlide();
  });
  next.addEventListener("click", () => {
    if (index >= slides.length - 1) return;
    index += 1;
    renderSlide();
  });

  if (!slides.length) {
    viewport.append(createElement("div", "document-empty", "This presentation contains no readable slides."));
    showStatus(status, "No slide text was found");
    return;
  }
  renderSlide();
}

async function renderOpenDocumentText(container, fileRecord) {
  const JSZip = await loadJsZip();
  const zip = await JSZip.loadAsync(await fileRecord.blob.arrayBuffer());
  const content = zip.file("content.xml");
  if (!content) throw new Error("The document has no content.xml file");

  const xml = await content.async("text");
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const { toolbar, viewport, status } = createDocumentShell(container, "word", fileRecord.name);
  const sheet = createElement("article", "document-sheet document-sheet--word");
  const nodes = [
    ...parsed.getElementsByTagNameNS("*", "h"),
    ...parsed.getElementsByTagNameNS("*", "p"),
  ];

  for (const node of nodes) {
    const tag = node.localName === "h" ? "h2" : "p";
    const text = node.textContent?.trim();
    if (text) sheet.append(createElement(tag, "", text));
  }
  if (!sheet.childElementCount) sheet.append(createElement("p", "", "This document contains no readable text."));
  viewport.append(sheet);
  attachDocumentZoom(toolbar, viewport, sheet, status, container);
}

async function renderMarkdownDocument(container, fileRecord) {
  const [marked, DOMPurify] = await Promise.all([loadMarked(), loadDomPurify()]);
  const text = await fileRecord.blob.text();
  const html = marked.parse(text, { gfm: true, breaks: true });
  renderSanitizedSheet(container, fileRecord, DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  }), "markdown");
}

async function renderHtmlDocument(container, fileRecord) {
  const DOMPurify = await loadDomPurify();
  const source = await fileRecord.blob.text();
  const safeHtml = DOMPurify.sanitize(source, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  });
  renderSanitizedSheet(container, fileRecord, safeHtml, "html");
}

function renderSanitizedSheet(container, fileRecord, safeHtml, kind) {
  const { toolbar, viewport, status } = createDocumentShell(container, kind, fileRecord.name);
  const sheet = createElement("article", `document-sheet document-sheet--${kind}`);
  sheet.innerHTML = safeHtml || "<p>This document contains no readable content.</p>";
  prepareDocumentLinks(sheet);
  viewport.append(sheet);
  attachDocumentZoom(toolbar, viewport, sheet, status, container);
}

function prepareDocumentLinks(root) {
  for (const link of root.querySelectorAll("a")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
}

function attachDocumentZoom(toolbar, viewport, sheet, status, container) {
  const zoomOut = iconButton("Zoom out", '<path d="M5 12h14"/>');
  const zoomIn = iconButton("Zoom in", '<path d="M12 5v14M5 12h14"/>');
  const reset = iconButton("Reset zoom", '<path d="M4 12a8 8 0 1 0 3-6.2L4 9M4 4v5h5"/>');
  const label = createElement("span", "document-zoom-label", "100%");
  const group = createElement("div", "document-control-group");
  group.append(zoomOut, label, zoomIn, reset);
  toolbar.append(group);

  let scale = 1;
  function apply() {
    sheet.style.fontSize = `${scale}rem`;
    label.textContent = `${Math.round(scale * 100)}%`;
  }
  zoomOut.addEventListener("click", () => {
    scale = clamp(scale / 1.15, .65, 2.2);
    apply();
  });
  zoomIn.addEventListener("click", () => {
    scale = clamp(scale * 1.15, .65, 2.2);
    apply();
  });
  reset.addEventListener("click", () => {
    scale = 1;
    apply();
    showStatus(status, "Zoom reset");
  });
  viewport.addEventListener("wheel", event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    scale = clamp(scale * Math.exp(-event.deltaY * .0015), .65, 2.2);
    apply();
  }, { passive: false });
  apply();

  const oldController = controllerMap.get(container);
  setController(container, {
    destroy() {
      oldController?.destroy?.();
    },
  });
}

async function renderJsonDocument(container, fileRecord) {
  const text = await fileRecord.blob.text();
  let formatted = text;
  try {
    formatted = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // Invalid JSON remains readable as source text.
  }
  renderCodeDocument(container, fileRecord, formatted, "JSON");
}

async function renderXmlDocument(container, fileRecord) {
  const text = await fileRecord.blob.text();
  renderCodeDocument(container, fileRecord, formatXml(text), "XML");
}

async function renderTextDocument(container, fileRecord) {
  const text = await fileRecord.blob.text();
  renderCodeDocument(container, fileRecord, text, extensionOf(fileRecord.name).toUpperCase() || "TEXT");
}

function renderCodeDocument(container, fileRecord, text, language) {
  const { toolbar, viewport, status } = createDocumentShell(container, "code", fileRecord.name);
  const languageBadge = createElement("span", "document-language-badge", language);
  toolbar.append(languageBadge);

  const codeWrap = createElement("div", "code-document");
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const gutter = createElement("pre", "code-document__lines", lines.map((_, index) => index + 1).join("\n"));
  const code = createElement("pre", "code-document__content", lines.join("\n"));
  codeWrap.append(gutter, code);
  viewport.append(codeWrap);
  showStatus(status, `${lines.length} line${lines.length === 1 ? "" : "s"}`);
}

async function renderRtfDocument(container, fileRecord) {
  const source = await fileRecord.blob.text();
  const text = rtfToText(source);
  const { toolbar, viewport, status } = createDocumentShell(container, "word", fileRecord.name);
  const sheet = createElement("article", "document-sheet document-sheet--word");
  for (const paragraph of text.split(/\n{2,}/)) {
    if (paragraph.trim()) sheet.append(createElement("p", "", paragraph.trim()));
  }
  if (!sheet.childElementCount) sheet.append(createElement("p", "", "This RTF file contains no readable text."));
  viewport.append(sheet);
  attachDocumentZoom(toolbar, viewport, sheet, status, container);
}

function rtfToText(source) {
  return source
    .replace(/\\u(-?\d+)\??/g, (_, value) => String.fromCharCode(Number(value) < 0 ? Number(value) + 65536 : Number(value)))
    .replace(/\\'([0-9a-f]{2})/gi, (_, value) => String.fromCharCode(parseInt(value, 16)))
    .replace(/\\par[d]?\b/gi, "\n\n")
    .replace(/\\line\b/gi, "\n")
    .replace(/\\tab\b/gi, "\t")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function renderArchiveDocument(container, fileRecord) {
  const JSZip = await loadJsZip();
  const zip = await JSZip.loadAsync(await fileRecord.blob.arrayBuffer());
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  const { toolbar, viewport, status } = createDocumentShell(container, "archive", fileRecord.name);
  toolbar.append(createElement("span", "document-language-badge", `${entries.length} FILE${entries.length === 1 ? "" : "S"}`));

  if (extensionOf(fileRecord.name) === "epub") {
    await renderEpubDocument(viewport, zip);
    return;
  }

  const list = createElement("div", "archive-list");
  for (const entry of entries) {
    const row = createElement("div", "archive-entry");
    row.append(
      createElement("span", "archive-entry__icon", "📄"),
      createElement("span", "archive-entry__name", entry.name),
      createElement("span", "archive-entry__meta", entry._data?.uncompressedSize ? formatSimpleBytes(entry._data.uncompressedSize) : "")
    );
    list.append(row);
  }
  if (!entries.length) list.append(createElement("div", "document-empty", "This archive is empty."));
  viewport.append(list);
  showStatus(status, "Archive opened locally");
}

async function renderEpubDocument(viewport, zip) {
  const htmlEntries = Object.values(zip.files)
    .filter(entry => !entry.dir && /\.(xhtml|html|htm)$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const DOMPurify = await loadDomPurify();
  const sheet = createElement("article", "document-sheet document-sheet--epub");

  for (const entry of htmlEntries.slice(0, 80)) {
    const html = await entry.async("text");
    const safe = DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    });
    const section = createElement("section", "epub-section");
    section.innerHTML = safe;
    prepareDocumentLinks(section);
    sheet.append(section);
  }
  if (!sheet.childElementCount) sheet.append(createElement("p", "", "This EPUB contains no readable chapters."));
  viewport.append(sheet);
}

async function renderLegacyOfficeDocument(container, fileRecord) {
  const buffer = await fileRecord.blob.arrayBuffer();
  const text = extractPrintableStrings(new Uint8Array(buffer));
  const { toolbar, viewport, status } = createDocumentShell(container, "legacy", fileRecord.name);
  toolbar.append(createElement("span", "document-language-badge", "LEGACY OFFICE"));
  const sheet = createElement("article", "document-sheet document-sheet--legacy");
  sheet.append(
    createElement("h2", "", fileRecord.name),
    createElement("p", "document-muted", "Ghost recovered the readable text from this older Office document."),
    createElement("pre", "legacy-document-text", text || "No readable text could be extracted, but the file remains available to download.")
  );
  viewport.append(sheet);
  showStatus(status, "Opened in legacy recovery mode", 2600);
}

async function renderBinaryDocument(container, fileRecord, options = {}) {
  const buffer = await fileRecord.blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const { toolbar, viewport, status } = createDocumentShell(container, "binary", fileRecord.name);
  toolbar.append(createElement("span", "document-language-badge", "SAFE INSPECTION"));

  const sheet = createElement("article", "document-sheet document-sheet--binary");
  const title = createElement("h2", "", options.title || fileRecord.name);
  const detail = createElement("p", "document-muted", options.detail || "Ghost opened this file in a safe local inspection view.");
  const summary = createElement("dl", "binary-summary");
  const signature = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  appendDefinition(summary, "Type", extensionOf(fileRecord.name).toUpperCase() || fileRecord.type || "Unknown");
  appendDefinition(summary, "Size", formatSimpleBytes(bytes.length));
  appendDefinition(summary, "Signature", signature || "Empty file");
  const strings = extractPrintableStrings(bytes);
  sheet.append(title, detail, summary, createElement("h3", "", "Readable contents"));
  sheet.append(createElement("pre", "legacy-document-text", strings || "No readable text was found in this binary file."));
  viewport.append(sheet);
  showStatus(status, "File opened safely inside Ghost");
}

function appendDefinition(list, term, value) {
  list.append(createElement("dt", "", term), createElement("dd", "", value));
}

function extractPrintableStrings(bytes) {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const utf8 = decoder.decode(bytes);
  const asciiStrings = utf8.match(/[\t\x20-\x7E\u00A0-\uFFFF]{4,}/g) || [];

  let utf16 = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const code = bytes[index] | (bytes[index + 1] << 8);
    utf16 += code >= 32 && code !== 0xFFFF ? String.fromCharCode(code) : "\n";
  }
  const utf16Strings = utf16.match(/[\t\x20-\uFFFF]{4,}/g) || [];
  const combined = [...asciiStrings, ...utf16Strings]
    .map(value => value.replace(/\s+/g, " ").trim())
    .filter(value => value.length >= 4 && !/^\W+$/.test(value));

  return [...new Set(combined)].slice(0, 500).join("\n");
}

function formatXml(source) {
  try {
    const parsed = new DOMParser().parseFromString(source, "application/xml");
    if (parsed.querySelector("parsererror")) return source;
    const serializer = new XMLSerializer();
    const compact = serializer.serializeToString(parsed).replace(/>\s*</g, "><");
    let depth = 0;
    return compact
      .replace(/(>)(<)(\/*)/g, "$1\n$2$3")
      .split("\n")
      .map(line => {
        if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
        const output = `${"  ".repeat(depth)}${line}`;
        if (/^<[^!?/][^>]*[^/]?>$/.test(line)) depth += 1;
        return output;
      })
      .join("\n");
  } catch {
    return source;
  }
}

function naturalSort(first, second) {
  return first.localeCompare(second, undefined, { numeric: true, sensitivity: "base" });
}

function formatSimpleBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}


const SEARCH_TEXT_LIMIT = 1_250_000;

function limitSearchText(value) {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_TEXT_LIMIT);
}

function textFromMarkup(source, mimeType = "text/html") {
  try {
    const documentNode = new DOMParser().parseFromString(source, mimeType);
    return documentNode.documentElement?.textContent || source;
  } catch {
    return source;
  }
}

async function extractPdfSearchText(fileRecord) {
  const pdfjs = await loadPdfModule();
  const data = new Uint8Array(await fileRecord.blob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str || "").join(" "));
      if (pages.join(" ").length >= SEARCH_TEXT_LIMIT) break;
    }
  } finally {
    loadingTask.destroy();
    pdf.destroy();
  }

  return pages.join("\n");
}

async function extractWordSearchText(fileRecord) {
  const mammoth = await loadMammoth();
  const result = await mammoth.extractRawText({
    arrayBuffer: await fileRecord.blob.arrayBuffer(),
  });
  return result.value || "";
}

async function extractSpreadsheetSearchText(fileRecord) {
  const XLSX = await loadSheetJs();
  const workbook = XLSX.read(await fileRecord.blob.arrayBuffer(), {
    type: "array",
    cellDates: true,
    cellText: true,
  });
  const sheets = [];

  for (const sheetName of workbook.SheetNames) {
    sheets.push(sheetName);
    sheets.push(XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], {
      blankrows: false,
    }));
    if (sheets.join(" ").length >= SEARCH_TEXT_LIMIT) break;
  }

  return sheets.join("\n");
}

async function extractZipXmlSearchText(fileRecord, extension) {
  const JSZip = await loadJsZip();
  const zip = await JSZip.loadAsync(await fileRecord.blob.arrayBuffer());

  if (extension === "zip" || extension === "epub") {
    const entries = Object.values(zip.files)
      .filter(entry => !entry.dir)
      .map(entry => entry.name);
    return entries.join("\n");
  }

  const xmlNames = Object.keys(zip.files)
    .filter(name => {
      if (extension === "odt" || extension === "fodt" || extension === "odp") {
        return name === "content.xml";
      }
      return /^ppt\/slides\/slide\d+\.xml$/i.test(name);
    })
    .sort(naturalSort);

  const parts = [];
  for (const name of xmlNames) {
    const source = await zip.file(name)?.async("text");
    if (!source) continue;
    parts.push(textFromMarkup(source, "application/xml"));
    if (parts.join(" ").length >= SEARCH_TEXT_LIMIT) break;
  }

  return parts.join("\n");
}

export async function extractSearchableText(fileRecord) {
  const extension = extensionOf(fileRecord.name);
  const type = String(fileRecord.type || "").toLowerCase();

  if (type === "application/pdf" || extension === "pdf") {
    return limitSearchText(await extractPdfSearchText(fileRecord));
  }

  if (WORD_EXTENSIONS.has(extension)) {
    return limitSearchText(await extractWordSearchText(fileRecord));
  }

  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return limitSearchText(await extractSpreadsheetSearchText(fileRecord));
  }

  if (PRESENTATION_EXTENSIONS.has(extension)
    || OPEN_DOCUMENT_TEXT_EXTENSIONS.has(extension)
    || ARCHIVE_EXTENSIONS.has(extension)) {
    return limitSearchText(await extractZipXmlSearchText(fileRecord, extension));
  }

  if (extension === "rtf" || type === "application/rtf" || type === "text/rtf") {
    return limitSearchText(rtfToText(await fileRecord.blob.text()));
  }

  if (MARKDOWN_EXTENSIONS.has(extension)
    || TEXT_EXTENSIONS.has(extension)
    || extension === "json"
    || type === "application/json"
    || type.startsWith("text/")) {
    const source = await fileRecord.blob.text();
    if (["html", "htm", "xml", "svg"].includes(extension)) {
      return limitSearchText(textFromMarkup(
        source,
        extension === "html" || extension === "htm" ? "text/html" : "application/xml"
      ));
    }
    return limitSearchText(source);
  }

  if (LEGACY_WORD_EXTENSIONS.has(extension)
    || LEGACY_PRESENTATION_EXTENSIONS.has(extension)) {
    return limitSearchText(
      extractPrintableStrings(new Uint8Array(await fileRecord.blob.arrayBuffer()))
    );
  }

  return "";
}

export function releaseDocumentPreview(container) {
  const controller = controllerMap.get(container);
  controller?.destroy?.();
  controllerMap.delete(container);
}
