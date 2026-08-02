import { extractSearchableText } from "./document-viewer.js";
import { extensionOf, fileCategory, fileTypeLabel } from "./file-types.js";
import { formatBytes, formatDate, formatRelativeDate } from "./utils.js";

const DAY_MS = 86_400_000;
const MAX_CACHE_ENTRIES = 80;
const CONTENT_EXTRACTION_TIMEOUT = 15_000;
const CONTENT_SEARCH_CATEGORIES = new Set([
  "pdf",
  "word",
  "spreadsheet",
  "presentation",
  "archive",
  "markdown",
  "data",
  "code",
  "text",
]);

const FILTER_CATEGORIES = Object.freeze({
  all: null,
  pdf: new Set(["pdf"]),
  word: new Set(["word"]),
  spreadsheet: new Set(["spreadsheet"]),
  presentation: new Set(["presentation"]),
  text: new Set(["text", "markdown", "data", "code", "database"]),
  archive: new Set(["archive"]),
  image: new Set(["image"]),
  media: new Set(["video", "audio"]),
  app: new Set(["app"]),
});

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSearchTerms(query) {
  const matches = String(query ?? "").match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
  return [...new Set(matches
    .map(term => term.replace(/^["']|["']$/g, ""))
    .map(normalizeText)
    .filter(Boolean))];
}

function matchesTerms(haystack, terms) {
  return terms.every(term => haystack.includes(term));
}

function sizeBand(size) {
  if (size < 1024 * 1024) return "small under 1 mb";
  if (size < 10 * 1024 * 1024) return "medium 1 to 10 mb";
  if (size < 100 * 1024 * 1024) return "large 10 to 100 mb";
  return "very large over 100 mb";
}

function metadataText(file, pinned) {
  const extension = extensionOf(file.name);
  const category = fileCategory(file);
  const date = new Date(file.createdAt);
  const dateParts = Number.isNaN(date.getTime())
    ? []
    : [
        date.getFullYear(),
        date.toLocaleDateString(undefined, { month: "long" }),
        date.toLocaleDateString(undefined, { month: "short" }),
        date.toLocaleDateString(undefined, { weekday: "long" }),
      ];

  return normalizeText([
    file.name,
    extension,
    category,
    fileTypeLabel(file),
    file.type,
    formatBytes(file.size),
    sizeBand(file.size),
    formatDate(file.createdAt),
    formatRelativeDate(file.createdAt),
    ...dateParts,
    pinned ? "pinned favourite favorite" : "",
    file.lastOpenedAt ? "recently opened" : "",
  ].join(" "));
}

function matchesTypeFilter(file, filter, isPinned) {
  if (filter === "pinned") return isPinned(file);
  const allowed = FILTER_CATEGORIES[filter] ?? null;
  return !allowed || allowed.has(fileCategory(file));
}

function matchesDateFilter(file, filter, now = Date.now()) {
  if (!filter || filter === "any") return true;

  const timestamp = Number(file.createdAt);
  if (!Number.isFinite(timestamp)) return false;

  const age = Math.max(0, now - timestamp);
  const fileDate = new Date(timestamp);
  const nowDate = new Date(now);

  switch (filter) {
    case "today":
      return fileDate.toDateString() === nowDate.toDateString();
    case "week":
      return age <= 7 * DAY_MS;
    case "month":
      return age <= 30 * DAY_MS;
    case "year":
      return fileDate.getFullYear() === nowDate.getFullYear();
    case "older":
      return age > 365 * DAY_MS;
    default:
      return true;
  }
}

function matchesSizeFilter(file, filter) {
  if (!filter || filter === "any") return true;

  const size = Number(file.size) || 0;
  const megabyte = 1024 * 1024;

  switch (filter) {
    case "small":
      return size < megabyte;
    case "medium":
      return size >= megabyte && size < 10 * megabyte;
    case "large":
      return size >= 10 * megabyte && size < 100 * megabyte;
    case "huge":
      return size >= 100 * megabyte;
    default:
      return true;
  }
}

function canSearchContents(file) {
  return CONTENT_SEARCH_CATEGORIES.has(fileCategory(file));
}

function contentSearchPriority(file) {
  const category = fileCategory(file);
  if (["text", "markdown", "data", "code"].includes(category)) return 0;
  if (category === "archive") return 1;
  if (["word", "spreadsheet", "presentation"].includes(category)) return 2;
  if (category === "pdf") return 3;
  return 4;
}

function withTimeout(promise, timeout, label) {
  let timer = 0;
  const timeoutPromise = new Promise((_, reject) => {
    timer = globalThis.setTimeout(
      () => reject(new Error(`${label} took too long to index`)),
      timeout
    );
  });

  return Promise.race([promise, timeoutPromise])
    .finally(() => globalThis.clearTimeout(timer));
}

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;

  async function runner() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runner)
  );
}

export function activeSearchFilterCount(criteria = {}) {
  return [
    criteria.type && criteria.type !== "all",
    criteria.date && criteria.date !== "any",
    criteria.size && criteria.size !== "any",
  ].filter(Boolean).length;
}

export function createFileSearchEngine({ isPinned = () => false } = {}) {
  const contentCache = new Map();
  let generation = 0;

  function cacheKey(file) {
    return [
      file.id,
      file.name,
      file.size,
      file.lastModified,
      file.createdAt,
    ].join(":");
  }

  function remember(key, value) {
    if (contentCache.has(key)) contentCache.delete(key);
    contentCache.set(key, value);

    while (contentCache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = contentCache.keys().next().value;
      contentCache.delete(oldestKey);
    }

    return value;
  }

  async function searchableContent(file) {
    const key = cacheKey(file);
    if (contentCache.has(key)) return contentCache.get(key);

    const pending = withTimeout(
      extractSearchableText(file),
      CONTENT_EXTRACTION_TIMEOUT,
      file.name
    ).then(text => ({
        text: normalizeText(text).slice(0, 1_250_000),
        failed: false,
      }))
      .catch(error => {
        console.info(`Ghost search could not index ${file.name}:`, error);
        return { text: "", failed: true };
      });

    remember(key, pending);
    const result = await pending;
    remember(key, result);
    return result;
  }

  async function search(files, criteria = {}, options = {}) {
    const searchGeneration = ++generation;
    const now = Date.now();
    const terms = parseSearchTerms(criteria.query);
    const typeFilter = criteria.type || "all";
    const dateFilter = criteria.date || "any";
    const sizeFilter = criteria.size || "any";
    const includeContents = criteria.includeContents !== false;
    const matches = new Map();
    const metadata = new Map();

    const filtered = files.filter(file => {
      const pinned = isPinned(file);
      if (!matchesTypeFilter(file, typeFilter, isPinned)) return false;
      if (!matchesDateFilter(file, dateFilter, now)) return false;
      if (!matchesSizeFilter(file, sizeFilter)) return false;

      metadata.set(file.id, metadataText(file, pinned));
      return true;
    });

    if (!terms.length) {
      return {
        cancelled: false,
        files: filtered,
        matches,
        queryTerms: [],
        contentCandidates: 0,
        contentFailures: 0,
      };
    }

    const candidates = [];
    for (const file of filtered) {
      const fileMetadata = metadata.get(file.id) || "";
      if (matchesTerms(fileMetadata, terms)) {
        matches.set(file.id, "metadata");
      } else if (includeContents && terms.join("").length >= 2 && canSearchContents(file)) {
        candidates.push(file);
      }
    }

    candidates.sort((first, second) =>
      contentSearchPriority(first) - contentSearchPriority(second)
    );

    let processed = 0;
    let failures = 0;

    options.onProgress?.({
      processed,
      total: candidates.length,
      matches: matches.size,
    });

    await runWithConcurrency(candidates, 3, async file => {
      if (searchGeneration !== generation) return;

      const contentResult = await searchableContent(file);
      if (contentResult.failed) failures += 1;

      const combined = `${metadata.get(file.id) || ""} ${contentResult.text}`;
      if (matchesTerms(combined, terms)) matches.set(file.id, "content");

      processed += 1;
      options.onProgress?.({
        processed,
        total: candidates.length,
        matches: matches.size,
      });
    });

    if (searchGeneration !== generation) {
      return { cancelled: true, files: [], matches: new Map(), queryTerms: terms };
    }

    return {
      cancelled: false,
      files: filtered.filter(file => matches.has(file.id)),
      matches,
      queryTerms: terms,
      contentCandidates: candidates.length,
      contentFailures: failures,
    };
  }

  function cancel() {
    generation += 1;
  }

  function clearCache() {
    contentCache.clear();
  }

  return Object.freeze({ search, cancel, clearCache });
}
