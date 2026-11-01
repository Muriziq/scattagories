import fs from "node:fs";
import path from "node:path";
import { fork, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory cache holding O(1) Sets for answer validation: Category -> Letter -> Set<string>
let activeCategoryLookups: Record<string, Record<string, Set<string>>> = {};
let activeAvailableCategories: string[] = [];
let lastUpdatedAt: string | null = null;
let cachedMetadata: {
  lastSync: string;
  totalWords: number;
  categoriesCount: number;
  stats: Record<string, number>;
} | null = null;
let isSyncInProgress = false;
let activeWorkerProcess: ChildProcess | null = null;
let dailyCheckTimer: NodeJS.Timeout | null = null;

// Returns the path to backend/data/categories/ directory
function getCategoriesDir(): string {
  return path.resolve(process.cwd(), "data", "categories");
}

function getMetadataPath(): string {
  return path.resolve(process.cwd(), "data", "metadata.json");
}

// Scans backend/data/categories/*.json, populates O(1) Sets, and executes an atomic pointer swap
export function loadCategoriesFromDisk(): boolean {
  const catDir = getCategoriesDir();
  if (!fs.existsSync(catDir)) {
    return false;
  }

  try {
    const files = fs.readdirSync(catDir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) {
      return false;
    }

    const newLookups: Record<string, Record<string, Set<string>>> = {};
    const newCategories: string[] = [];

    for (const file of files) {
      const filePath = path.join(catDir, file);
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);

        const categoryName = parsed.category || path.basename(file, ".json");
        const formattedName = categoryName.toLowerCase();

        newCategories.push(formattedName);
        newLookups[formattedName] = {};

        if (parsed.letters && typeof parsed.letters === "object") {
          for (const [letter, words] of Object.entries(
            parsed.letters as Record<string, string[]>,
          )) {
            newLookups[formattedName][letter] = new Set(words);
          }
        }
      } catch (err: any) {
        console.error(
          `[CategoryManager] Failed to parse ${file}:`,
          err.message,
        );
      }
    }

    if (newCategories.length === 0) return false;

    // Load metadata if available
    const metaPath = getMetadataPath();
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        cachedMetadata = {
          lastSync: meta.lastSync || new Date().toISOString(),
          totalWords: typeof meta.totalWords === "number" ? meta.totalWords : 0,
          categoriesCount: typeof meta.categoriesCount === "number" ? meta.categoriesCount : newCategories.length,
          stats: meta.stats && typeof meta.stats === "object" ? meta.stats : {},
        };
        lastUpdatedAt = cachedMetadata.lastSync;
      } catch {
        lastUpdatedAt = new Date().toISOString();
      }
    } else {
      lastUpdatedAt = new Date().toISOString();
    }

    // Atomic pointer swap: main thread active games experience zero lag
    activeCategoryLookups = newLookups;
    activeAvailableCategories = newCategories;

    const totalWords = cachedMetadata?.totalWords ?? 0;

    console.log(
      `[CategoryManager] Successfully loaded ${newCategories.length} categories (${totalWords} total words) from individual JSON files.`,
    );
    return true;
  } catch (err: any) {
    console.error(
      "[CategoryManager] Failed to load categories directory:",
      err.message,
    );
    return false;
  }
}

// Spawns the isolated background worker in a separate process to fetch datasets
export function triggerBackgroundSync(): { started: boolean; message: string } {
  if (isSyncInProgress) {
    return {
      started: false,
      message: "Category synchronization is already in progress.",
    };
  }

  isSyncInProgress = true;

  // Resolve worker script path depending on tsx dev mode vs compiled dist
  const isTypeScript = __filename.endsWith(".ts");
  const workerScript = isTypeScript
    ? path.resolve(process.cwd(), "src", "workers", "categoryWorker.ts")
    : path.resolve(process.cwd(), "dist", "workers", "categoryWorker.js");

  console.log(`[CategoryManager] Spawning background worker: ${workerScript}`);

  try {
    activeWorkerProcess = fork(workerScript, [], {
      execArgv: isTypeScript ? ["--import", "tsx"] : [],
      stdio: ["inherit", "inherit", "inherit", "ipc"],
    });

    activeWorkerProcess.on("message", (msg: any) => {
      if (msg?.type === "SYNC_COMPLETE") {
        console.log(
          `[CategoryManager] Background sync completed in ${msg.durationMs}ms with ${msg.totalWords} words.`,
        );
        // Reload into memory with zero downtime
        loadCategoriesFromDisk();
      } else if (msg?.type === "SYNC_ERROR") {
        console.error(
          `[CategoryManager] Background sync reported error:`,
          msg.error,
        );
      }
    });

    activeWorkerProcess.on("exit", (code) => {
      isSyncInProgress = false;
      activeWorkerProcess = null;
      console.log(
        `[CategoryManager] Background worker exited with code ${code}.`,
      );
    });

    activeWorkerProcess.on("error", (err) => {
      isSyncInProgress = false;
      activeWorkerProcess = null;
      console.error(
        `[CategoryManager] Failed to spawn background worker:`,
        err,
      );
    });

    return {
      started: true,
      message: "Background category synchronization initiated.",
    };
  } catch (err: any) {
    isSyncInProgress = false;
    activeWorkerProcess = null;
    return {
      started: false,
      message: `Failed to initiate sync: ${err.message}`,
    };
  }
}

// Checks if cache is older than 30 days and triggers background update
export function checkSyncNeeded(): void {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  if (!cachedMetadata || !cachedMetadata.lastSync) {
    console.log(
      "[CategoryManager] No category metadata found. Triggering background sync...",
    );
    triggerBackgroundSync();
    return;
  }

  try {
    const lastSyncTime = new Date(cachedMetadata.lastSync).getTime();
    const ageMs = Date.now() - lastSyncTime;
    const ageDays = (ageMs / (1000 * 60 * 60 * 24)).toFixed(1);

    if (ageMs > THIRTY_DAYS_MS) {
      console.log(
        `[CategoryManager] Category data is ${ageDays} days old (> 30 days). Triggering background sync...`,
      );
      triggerBackgroundSync();
    } else {
      console.log(
        `[CategoryManager] Category data is ${ageDays} days old (fresh, no sync required).`,
      );
    }
  } catch (err: any) {
    console.error("[CategoryManager] Error checking cache age:", err.message);
  }
}

// Initializes the Category Manager on server boot
export function initCategoryManager(): void {
  // 1. Immediately load whatever is currently on disk (< 5ms)
  loadCategoriesFromDisk();

  // 2. Check if background sync is needed (first boot or older than 30 days)
  checkSyncNeeded();

  // 3. Schedule daily heartbeat check (runs once every 24 hours, safe from 32-bit overflow)
  if (dailyCheckTimer) {
    clearInterval(dailyCheckTimer);
  }
  dailyCheckTimer = setInterval(
    () => {
      checkSyncNeeded();
    },
    24 * 60 * 60 * 1000,
  );
}

// Public accessors for game engine and routers
export function getAvailableCategories(): readonly string[] {
  return activeAvailableCategories;
}

export function isCategoryAvailable(category: string): boolean {
  return Boolean(activeCategoryLookups[category.toLowerCase()]);
}

// Parent category to subcategories inheritance map
// When querying "animals", words in "animals", "birds", and "dogs" are all valid.
// When querying "food", words in "food" and "fruits and vegetables" are all valid.
const CATEGORY_INHERITANCE: Record<string, string[]> = {
  animals: ["animals", "birds", "dogs"],
  food: ["food", "fruits and vegetables"],
};

export function isCategoryWordValid(
  category: string,
  letter: string,
  word: string,
): boolean {
  const cat = category.toLowerCase();
  const letChar = letter.toUpperCase();
  const subCats = CATEGORY_INHERITANCE[cat] || [cat];

  for (const c of subCats) {
    if (activeCategoryLookups[c]?.[letChar]?.has(word)) {
      return true;
    }
  }
  return false;
}

export function getCategoryWordSet(
  category: string,
  letter: string,
): Set<string> | undefined {
  const cat = category.toLowerCase();
  const letChar = letter.toUpperCase();
  const subCats = CATEGORY_INHERITANCE[cat];

  if (!subCats || subCats.length === 1) {
    return activeCategoryLookups[cat]?.[letChar];
  }

  // Combine sets for inherited categories so code expecting a single Set still works
  const combined = new Set<string>();
  for (const c of subCats) {
    const set = activeCategoryLookups[c]?.[letChar];
    if (set) {
      for (const w of set) combined.add(w);
    }
  }
  return combined;
}

export function getCategoryStats() {
  return {
    isSyncInProgress,
    lastUpdatedAt: cachedMetadata?.lastSync || lastUpdatedAt,
    totalWords: cachedMetadata?.totalWords || 0,
    categoriesCount: cachedMetadata?.categoriesCount || activeAvailableCategories.length,
    categories: cachedMetadata?.stats || {},
  };
}
