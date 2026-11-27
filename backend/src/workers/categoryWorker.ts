import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utility to normalize answers: trim, lowercase, remove diacritics and leading punctuation
function normalizeWord(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^a-z0-9]/i, "")
    .replace(/\s+/g, " ");
}

// Fetch helper with timeout to avoid hanging the process if an API is down
async function fetchWithTimeout(url: string, timeoutMs: number = 15000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Scatterblitz-CategorySync/1.0",
        Accept: "application/json, text/plain, */*",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Group an array or set of words into { [letter: "A".."Z"]: string[] }
function groupWordsByLetter(words: Iterable<string>): Record<string, string[]> {
  const grouped: Record<string, Set<string>> = {};
  for (let c = 65; c <= 90; c++) {
    grouped[String.fromCharCode(c)] = new Set<string>();
  }

  for (const raw of words) {
    const clean = normalizeWord(raw);
    if (!clean) continue;
    const firstChar = clean[0]?.toUpperCase();
    if (firstChar >= "A" && firstChar <= "Z") {
      grouped[firstChar].add(clean);
    }
  }

  const result: Record<string, string[]> = {};
  for (const letter of Object.keys(grouped)) {
    result[letter] = Array.from(grouped[letter]).sort();
  }
  return result;
}

// Resolves backend/data/ directory whether run from root or backend folder
const backendRoot = process.cwd().endsWith("backend")
  ? process.cwd()
  : path.resolve(process.cwd(), "backend");

function getCategoriesDir(): string {
  return path.resolve(backendRoot, "data", "categories");
}

function getMetadataPath(): string {
  return path.resolve(backendRoot, "data", "metadata.json");
}

// Atomically writes a single category file (temp file -> rename)
function saveCategoryFile(categoryName: string, letterMap: Record<string, string[]>): number {
  const catDir = getCategoriesDir();
  if (!fs.existsSync(catDir)) {
    fs.mkdirSync(catDir, { recursive: true });
  }

  const slug = categoryName.toLowerCase();
  const targetPath = path.join(catDir, `${slug}.json`);
  const tempPath = path.join(catDir, `${slug}.json.tmp`);

  const wordCount = Object.values(letterMap).reduce((acc, words) => acc + words.length, 0);
  const payload = {
    category: slug,
    updatedAt: new Date().toISOString(),
    wordCount,
    letters: letterMap,
  };

  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf-8");
  fs.renameSync(tempPath, targetPath);
  return wordCount;
}

// Loads an existing category from disk if fetch fails (preserves existing dataset)
function loadExistingCategory(categoryName: string): Record<string, string[]> | null {
  const catDir = getCategoriesDir();
  const filePath = path.join(catDir, `${categoryName.toLowerCase()}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return data.letters || null;
  } catch {
    return null;
  }
}

// URL Endpoints
const API_ENDPOINTS = {
  // Reference endpoint for global geographic data (Countries, States, Cities, Capitals):
  countryStateCityReference: "https://csc.sidsworld.co.in/public/api",

  // Active production endpoints
  languages: "https://raw.githubusercontent.com/maikudou/iso639-js/master/reference/iso639-3.json",
  pokemon: "https://pokeapi.co/api/v2/pokemon?limit=1500",
  elements: "https://raw.githubusercontent.com/neelpatel05/periodic-table-api/master/data.json",

  // Inactive / Disabled incomplete endpoints (kept for reference):
  // corporaCommonAnimals: "https://raw.githubusercontent.com/dariusk/corpora/master/data/animals/common.json",
  // corporaBirds: "https://raw.githubusercontent.com/dariusk/corpora/master/data/animals/birds_north_america.json",
  // dogBreeds: "https://dog.ceo/api/breeds/list/all",
  // mealDbIngredients: "https://www.themealdb.com/api/json/v1/1/list.php?i=list",
  // corporaFruits: "https://raw.githubusercontent.com/dariusk/corpora/master/data/foods/fruits.json",
  // corporaVegetables: "https://raw.githubusercontent.com/dariusk/corpora/master/data/foods/vegetables.json",
};

export async function runCategorySync(): Promise<void> {
  console.log("[CategoryWorker] Starting parallel category ingestion...");
  const startTime = Date.now();
  const stats: Record<string, number> = {};

  // 1. Fetch active external datasets concurrently using Promise.allSettled
  const [
    languagesRes,
    pokemonRes,
    elementsRes,
  ] = await Promise.allSettled([
    fetchWithTimeout(API_ENDPOINTS.languages),
    fetchWithTimeout(API_ENDPOINTS.pokemon),
    fetchWithTimeout(API_ENDPOINTS.elements),
  ]);

  // 2. Process Languages Category (ISO 639-3 full 7,800+ languages + common vernacular aliases)
  try {
    const languageWords = new Set<string>();

    if (languagesRes.status === "fulfilled" && typeof languagesRes.value === "object" && languagesRes.value !== null) {
      for (const item of Object.values(languagesRes.value) as any[]) {
        if (typeof item?.referenceName === "string") {
          const raw = item.referenceName;
          const base = raw.split("(")[0].trim();
          if (base) {
            languageWords.add(base);
            // Handle compound suffixes (e.g. "Mandarin Chinese" -> both "Mandarin Chinese" and "Mandarin")
            if (base.endsWith(" Chinese")) languageWords.add(base.replace(" Chinese", "").trim());
            if (base.endsWith(" Greek")) languageWords.add(base.replace(" Greek", "").trim());
          }
          // Include inside-parentheses name if present (e.g. "Swahili (individual language)" -> "Swahili")
          if (raw.includes("(") && raw.includes(")")) {
            const inside = raw.substring(raw.indexOf("(") + 1, raw.indexOf(")")).trim();
            if (inside && inside.length > 2 && !inside.toLowerCase().includes("language") && !inside.toLowerCase().includes("macrolanguage")) {
              languageWords.add(inside);
            }
          }
        }
      }
    } else if (languagesRes.status === "rejected") {
      console.warn("[CategoryWorker] Languages fetch failed:", languagesRes.reason?.message);
    }

    // Common everyday player aliases/variants (e.g. Greek, Cantonese, Punjabi, Gaelic)
    const commonAliases = [
      "Mandarin", "Cantonese", "Punjabi", "Panjabi", "Swahili", "Greek",
      "Odia", "Oriya", "Filipino", "Tagalog", "Sudanese", "Sundanese", "Bhojpuri",
      "Gaelic", "Scottish Gaelic", "Irish Gaelic", "Haitian Creole"
    ];
    for (const alias of commonAliases) {
      languageWords.add(alias);
    }

    if (languageWords.size > 0) {
      stats["languages"] = saveCategoryFile("languages", groupWordsByLetter(languageWords));
    } else {
      const existing = loadExistingCategory("languages");
      if (existing) stats["languages"] = saveCategoryFile("languages", existing);
    }
  } catch (err: any) {
    console.error("[CategoryWorker] Error processing languages:", err.message);
  }

  // 3. Process Pokemon Category (limit 1500)
  try {
    if (pokemonRes.status === "fulfilled" && Array.isArray(pokemonRes.value?.results)) {
      const pokeNames = pokemonRes.value.results.map((p: any) => p.name);
      stats["pokemon"] = saveCategoryFile("pokemon", groupWordsByLetter(pokeNames));
    } else {
      if (pokemonRes.status === "rejected") {
        console.warn("[CategoryWorker] PokéAPI fetch failed:", pokemonRes.reason?.message);
      }
      const existing = loadExistingCategory("pokemon");
      if (existing) stats["pokemon"] = saveCategoryFile("pokemon", existing);
    }
  } catch (err: any) {
    console.error("[CategoryWorker] Error processing pokemon:", err.message);
  }

  // 4. Process Elements Category
  try {
    if (elementsRes.status === "fulfilled" && Array.isArray(elementsRes.value)) {
      const elementNames = elementsRes.value.map((e: any) => e.name);
      stats["elements"] = saveCategoryFile("elements", groupWordsByLetter(elementNames));
    } else {
      if (elementsRes.status === "rejected") {
        console.warn("[CategoryWorker] Elements fetch failed:", elementsRes.reason?.message);
      }
      const existing = loadExistingCategory("elements");
      if (existing) stats["elements"] = saveCategoryFile("elements", existing);
    }
  } catch (err: any) {
    console.error("[CategoryWorker] Error processing elements:", err.message);
  }

  // 5. Base Categories (Countries, Capitals, Currencies, States, Cities)
  for (const baseCategory of ["countries", "capitals", "currencies", "states", "cities"]) {
    const existing = loadExistingCategory(baseCategory);
    if (existing) {
      const wordCount = Object.values(existing).reduce((acc, words) => acc + words.length, 0);
      stats[baseCategory] = wordCount;
    }
  }

  // 6. Update metadata atomically
  const metadataPath = getMetadataPath();
  const tempMeta = `${metadataPath}.tmp`;
  const totalWords = Object.values(stats).reduce((acc, c) => acc + c, 0);
  const metadataPayload = {
    lastSync: new Date().toISOString(),
    totalWords,
    categoriesCount: Object.keys(stats).length,
    stats,
  };
  fs.writeFileSync(tempMeta, JSON.stringify(metadataPayload, null, 2), "utf-8");
  fs.renameSync(tempMeta, metadataPath);

  const durationMs = Date.now() - startTime;
  console.log(
    `[CategoryWorker] Category sync finished in ${durationMs}ms. Categories: ${Object.keys(stats).length}, Total words: ${totalWords}`
  );

  // Send IPC message to parent process if spawned via fork
  if (process.send) {
    process.send({
      type: "SYNC_COMPLETE",
      durationMs,
      totalWords,
      stats,
      updatedAt: metadataPayload.lastSync,
    });
  }
}

// Auto-run when executed as entry point in child process
if (process.argv[1] && (process.argv[1].endsWith("categoryWorker.ts") || process.argv[1].endsWith("categoryWorker.js"))) {
  runCategorySync()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("[CategoryWorker] Fatal error during sync:", err);
      if (process.send) {
        process.send({ type: "SYNC_ERROR", error: err.message });
      }
      process.exit(1);
    });
}
