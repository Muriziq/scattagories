import fs from "node:fs";
import path from "node:path";

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

// Atomically writes a single category file (temp file -> rename)
function saveCategoryFile(categoryName: string, letterMap: Record<string, string[]>): number {
  const catDir = path.resolve(process.cwd(), "data", "categories");
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
  const filePath = path.resolve(process.cwd(), "data", "categories", `${categoryName.toLowerCase()}.json`);
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
  corporaCommonAnimals: "https://raw.githubusercontent.com/dariusk/corpora/master/data/animals/common.json",
  corporaBirds: "https://raw.githubusercontent.com/dariusk/corpora/master/data/animals/birds_north_america.json",
  dogBreeds: "https://dog.ceo/api/breeds/list/all",
  mealDbIngredients: "https://www.themealdb.com/api/json/v1/1/list.php?i=list",
  corporaFruits: "https://raw.githubusercontent.com/dariusk/corpora/master/data/foods/fruits.json",
  corporaVegetables: "https://raw.githubusercontent.com/dariusk/corpora/master/data/foods/vegetables.json",
  pokemon: "https://pokeapi.co/api/v2/pokemon?limit=1025",
  elements: "https://raw.githubusercontent.com/neelpatel05/periodic-table-api/master/data.json",
};

export async function runCategorySync(): Promise<void> {
  console.log("[CategoryWorker] Starting parallel category ingestion...");
  const startTime = Date.now();
  const stats: Record<string, number> = {};

  // 1. Fetch ALL external datasets concurrently using Promise.allSettled
  const [
    commonAnimalsRes,
    birdsRes,
    dogBreedsRes,
    mealDbRes,
    fruitsRes,
    vegetablesRes,
    pokemonRes,
    elementsRes,
  ] = await Promise.allSettled([
    fetchWithTimeout(API_ENDPOINTS.corporaCommonAnimals),
    fetchWithTimeout(API_ENDPOINTS.corporaBirds),
    fetchWithTimeout(API_ENDPOINTS.dogBreeds),
    fetchWithTimeout(API_ENDPOINTS.mealDbIngredients),
    fetchWithTimeout(API_ENDPOINTS.corporaFruits),
    fetchWithTimeout(API_ENDPOINTS.corporaVegetables),
    fetchWithTimeout(API_ENDPOINTS.pokemon),
    fetchWithTimeout(API_ENDPOINTS.elements),
  ]);

  // 2. Process Animals Category (Common & Wild Animals Only)
  try {
    const animalWords = new Set<string>();

    if (commonAnimalsRes.status === "fulfilled" && Array.isArray(commonAnimalsRes.value?.animals)) {
      for (const a of commonAnimalsRes.value.animals) {
        animalWords.add(a);
      }
    } else if (commonAnimalsRes.status === "rejected") {
      console.warn("[CategoryWorker] Common animals fetch failed:", commonAnimalsRes.reason?.message);
    }

    if (animalWords.size > 0) {
      stats["animals"] = saveCategoryFile("animals", groupWordsByLetter(animalWords));
    } else {
      const existing = loadExistingCategory("animals");
      if (existing) stats["animals"] = saveCategoryFile("animals", existing);
    }
  } catch (err: any) {
    console.error("[CategoryWorker] Error processing animals:", err.message);
  }

  // 3. Process Birds Category (Dedicated Category)
  try {
    const birdWords = new Set<string>();

    if (birdsRes.status === "fulfilled" && Array.isArray(birdsRes.value?.birds)) {
      for (const group of birdsRes.value.birds) {
        if (Array.isArray(group?.members)) {
          for (const b of group.members) {
            birdWords.add(b);
          }
        }
      }
    } else if (birdsRes.status === "rejected") {
      console.warn("[CategoryWorker] Birds fetch failed:", birdsRes.reason?.message);
    }

    if (birdWords.size > 0) {
      stats["birds"] = saveCategoryFile("birds", groupWordsByLetter(birdWords));
    } else {
      const existing = loadExistingCategory("birds");
      if (existing) stats["birds"] = saveCategoryFile("birds", existing);
    }
  } catch (err: any) {
    console.error("[CategoryWorker] Error processing birds:", err.message);
  }

  // 4. Process Dogs Category (Dedicated Category)
  try {
    const dogWords = new Set<string>();

    if (dogBreedsRes.status === "fulfilled" && dogBreedsRes.value?.message && typeof dogBreedsRes.value.message === "object") {
      for (const [breed, subBreeds] of Object.entries(dogBreedsRes.value.message)) {
        dogWords.add(breed);
        if (Array.isArray(subBreeds)) {
          for (const sub of subBreeds) {
            dogWords.add(`${sub} ${breed}`);
          }
        }
      }
    } else if (dogBreedsRes.status === "rejected") {
      console.warn("[CategoryWorker] Dog breeds fetch failed:", dogBreedsRes.reason?.message);
    }

    if (dogWords.size > 0) {
      stats["dogs"] = saveCategoryFile("dogs", groupWordsByLetter(dogWords));
    } else {
      const existing = loadExistingCategory("dogs");
      if (existing) stats["dogs"] = saveCategoryFile("dogs", existing);
    }
  } catch (err: any) {
    console.error("[CategoryWorker] Error processing dogs:", err.message);
  }

  // 5. Process Fruits and Vegetables Category (Dedicated Category)
  try {
    const fruitVegWords = new Set<string>();

    if (fruitsRes.status === "fulfilled" && Array.isArray(fruitsRes.value?.fruits)) {
      for (const f of fruitsRes.value.fruits) {
        fruitVegWords.add(f);
      }
    } else if (fruitsRes.status === "rejected") {
      console.warn("[CategoryWorker] Fruits fetch failed:", fruitsRes.reason?.message);
    }

    if (vegetablesRes.status === "fulfilled" && Array.isArray(vegetablesRes.value?.vegetables)) {
      for (const v of vegetablesRes.value.vegetables) {
        fruitVegWords.add(v);
      }
    } else if (vegetablesRes.status === "rejected") {
      console.warn("[CategoryWorker] Vegetables fetch failed:", vegetablesRes.reason?.message);
    }

    if (fruitVegWords.size > 0) {
      stats["fruits and vegetables"] = saveCategoryFile("fruits and vegetables", groupWordsByLetter(fruitVegWords));
    } else {
      const existing = loadExistingCategory("fruits and vegetables");
      if (existing) stats["fruits and vegetables"] = saveCategoryFile("fruits and vegetables", existing);
    }
  } catch (err: any) {
    console.error("[CategoryWorker] Error processing fruits and vegetables:", err.message);
  }

  // 6. Process Food Category (TheMealDB Culinary Ingredients Only)
  try {
    const foodWords = new Set<string>();

    if (mealDbRes.status === "fulfilled" && Array.isArray(mealDbRes.value?.meals)) {
      for (const item of mealDbRes.value.meals) {
        if (item?.strIngredient) foodWords.add(item.strIngredient);
      }
    } else if (mealDbRes.status === "rejected") {
      console.warn("[CategoryWorker] TheMealDB fetch failed:", mealDbRes.reason?.message);
    }

    if (foodWords.size > 0) {
      stats["food"] = saveCategoryFile("food", groupWordsByLetter(foodWords));
    } else {
      const existing = loadExistingCategory("food");
      if (existing) stats["food"] = saveCategoryFile("food", existing);
    }
  } catch (err: any) {
    console.error("[CategoryWorker] Error processing food:", err.message);
  }

  // 7. Process Pokemon Category
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

  // 8. Process Elements Category
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

  // 9. Base Categories (Countries, Capitals, Currencies, States)
  for (const baseCategory of ["countries", "capitals", "currencies", "states"]) {
    const existing = loadExistingCategory(baseCategory);
    if (existing) {
      const wordCount = Object.values(existing).reduce((acc, words) => acc + words.length, 0);
      stats[baseCategory] = wordCount;
    }
  }

  // 10. Update data/metadata.json atomically
  const metadataPath = path.resolve(process.cwd(), "data", "metadata.json");
  const tempMeta = path.resolve(process.cwd(), "data", "metadata.json.tmp");
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
