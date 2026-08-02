const EXTENSION_GROUPS = Object.freeze({
  image: new Set(["avif", "bmp", "gif", "heic", "heif", "ico", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"]),
  video: new Set(["avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm", "wmv"]),
  audio: new Set(["aac", "aiff", "alac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav", "wma"]),
  pdf: new Set(["pdf"]),
  word: new Set(["doc", "docm", "docx", "dot", "dotm", "dotx", "fodt", "odt", "rtf"]),
  spreadsheet: new Set(["csv", "dif", "numbers", "ods", "sylk", "tsv", "xls", "xlsb", "xlsm", "xlsx"]),
  presentation: new Set(["odp", "pot", "potm", "potx", "pps", "ppsm", "ppsx", "ppt", "pptm", "pptx"]),
  archive: new Set(["7z", "bz2", "epub", "gz", "rar", "tar", "tgz", "xz", "zip"]),
  markdown: new Set(["markdown", "md", "mdown", "mkd"]),
  data: new Set(["json", "json5", "toml", "xml", "yaml", "yml"]),
  database: new Set(["accdb", "db", "mdb", "sqlite", "sqlite3"]),
  code: new Set([
    "asm", "bat", "c", "cjs", "conf", "cpp", "cs", "css", "env", "go", "h", "hpp",
    "htm", "html", "ini", "java", "js", "jsx", "kt", "kts", "mjs", "php", "properties",
    "ps1", "py", "rb", "rs", "scss", "sh", "sql", "svelte", "swift", "ts", "tsx", "vue",
  ]),
  text: new Set(["log", "text", "txt"]),
  app: new Set(["apk", "appx", "deb", "dmg", "exe", "ipa", "msi", "pkg", "rpm"]),
});

const NORMALISED_LABELS = Object.freeze({
  jpeg: "JPG",
  markdown: "MD",
  mdown: "MD",
  mkd: "MD",
  htm: "HTML",
  yml: "YAML",
  tif: "TIFF",
  tgz: "TAR.GZ",
});

const FALLBACK_LABELS = Object.freeze({
  image: "IMAGE",
  video: "VIDEO",
  audio: "AUDIO",
  pdf: "PDF",
  word: "DOC",
  spreadsheet: "SHEET",
  presentation: "SLIDES",
  archive: "ARCHIVE",
  markdown: "MD",
  data: "DATA",
  database: "DATABASE",
  code: "CODE",
  text: "TEXT",
  app: "APP",
  generic: "FILE",
});

const ICON_PATHS = Object.freeze({
  image: `
    <rect x="4" y="5" width="16" height="14" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m6.5 17 4.2-4.4 2.6 2.5 2.2-2.2 2.5 4.1" />
  `,
  video: `
    <rect x="4" y="5" width="16" height="14" rx="3" />
    <path class="file-type-icon__fill" d="m10 9 5 3-5 3Z" />
  `,
  audio: `
    <path d="M9 18V7l9-2v11" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="15.5" cy="16" r="2.5" />
  `,
  pdf: `
    <path d="M7 3.5h7l4 4V20.5H7Z" />
    <path d="M14 3.5v4h4" />
    <path d="M9.5 13.5h5M9.5 17h4" />
  `,
  word: `
    <path d="M7 3.5h7l4 4V20.5H7Z" />
    <path d="M14 3.5v4h4M9.5 12h5M9.5 15h5M9.5 18h3.5" />
  `,
  spreadsheet: `
    <path d="M6 3.5h12v17H6Z" />
    <path d="M6 9h12M6 14h12M11 9v11" />
  `,
  presentation: `
    <rect x="4" y="5" width="16" height="12" rx="2" />
    <path d="M12 17v4M8.5 21h7M8 13l2.5-2.5 2 1.8L16 9" />
  `,
  archive: `
    <path d="M6 5h12v15H6Z" />
    <path d="M10 5v3h4V5M10 11h4M10 14h4M10 17h4" />
  `,
  markdown: `
    <rect x="3.5" y="5" width="17" height="14" rx="3" />
    <path d="M7 15v-5l2.5 3 2.5-3v5M15 10v5M13.5 13.5 15 15l1.5-1.5" />
  `,
  data: `
    <path d="M9 5c-2 0-3 1.2-3 3v1c0 1.2-.7 2-2 2 1.3 0 2 .8 2 2v1c0 1.8 1 3 3 3M15 5c2 0 3 1.2 3 3v1c0 1.2.7 2 2 2-1.3 0-2 .8-2 2v1c0 1.8-1 3-3 3" />
  `,
  database: `
    <ellipse cx="12" cy="6" rx="6" ry="3" />
    <path d="M6 6v6c0 1.7 2.7 3 6 3s6-1.3 6-3V6M6 12v6c0 1.7 2.7 3 6 3s6-1.3 6-3v-6" />
  `,
  code: `
    <path d="m9 7-5 5 5 5M15 7l5 5-5 5M13.5 5l-3 14" />
  `,
  text: `
    <path d="M7 3.5h7l4 4V20.5H7Z" />
    <path d="M14 3.5v4h4M9.5 12h5M9.5 15h5M9.5 18h3" />
  `,
  app: `
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  `,
  generic: `
    <path d="M7 3.5h7l4 4V20.5H7Z" />
    <path d="M14 3.5v4h4M9.5 13h5M9.5 16.5h3.5" />
  `,
});

export function extensionOf(name = "") {
  const trimmed = String(name).trim().toLowerCase();
  const lastDot = trimmed.lastIndexOf(".");
  return lastDot > 0 && lastDot < trimmed.length - 1
    ? trimmed.slice(lastDot + 1)
    : "";
}

export function fileCategory(file = {}) {
  const type = String(file.type || "").toLowerCase();
  const extension = extensionOf(file.name);

  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";

  for (const [category, extensions] of Object.entries(EXTENSION_GROUPS)) {
    if (extensions.has(extension)) return category;
  }

  if (type === "application/pdf") return "pdf";
  if (type.includes("word") || type.includes("opendocument.text") || type === "application/rtf") return "word";
  if (type.includes("sheet") || type.includes("excel") || type.includes("spreadsheet")) return "spreadsheet";
  if (type.includes("presentation") || type.includes("powerpoint")) return "presentation";
  if (type.includes("zip") || type.includes("compressed") || type.includes("archive")) return "archive";
  if (type.includes("json") || type.includes("xml") || type.includes("yaml")) return "data";
  if (type.startsWith("text/")) return "text";

  return "generic";
}

export function fileTypeLabel(file = {}) {
  const extension = extensionOf(file.name);
  const category = fileCategory(file);

  if (extension) {
    return NORMALISED_LABELS[extension]
      || (extension.length <= 8 ? extension.toUpperCase() : FALLBACK_LABELS[category]);
  }

  return FALLBACK_LABELS[category];
}

export function fileIconMarkup(file = {}) {
  const category = fileCategory(file);
  const paths = ICON_PATHS[category] || ICON_PATHS.generic;

  return `
    <svg class="file-type-icon" viewBox="0 0 24 24" aria-hidden="true">
      ${paths}
    </svg>
  `;
}

export function getFilePresentation(file = {}) {
  const category = fileCategory(file);

  return Object.freeze({
    category,
    label: fileTypeLabel(file),
    icon: fileIconMarkup(file),
  });
}
