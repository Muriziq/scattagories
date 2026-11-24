import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categoriesDir = path.resolve(__dirname, "../data/categories");
const metadataPath = path.resolve(__dirname, "../data/metadata.json");

function normalizeWord(word) {
  if (!word) return "";
  return word
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^a-z0-9]/i, "");
}

function getFirstLetter(word) {
  const norm = normalizeWord(word);
  if (!norm) return null;
  const ch = norm[0].toUpperCase();
  return /^[A-Z]$/.test(ch) ? ch : null;
}

function addWordToLetters(lettersMap, word) {
  const clean = word.toLowerCase().trim();
  if (!clean || clean.length < 2) return false;
  const letter = getFirstLetter(clean);
  if (!letter) return false;

  if (!lettersMap[letter]) {
    lettersMap[letter] = [];
  }

  const existingSet = new Set(lettersMap[letter]);
  if (!existingSet.has(clean)) {
    lettersMap[letter].push(clean);
    lettersMap[letter].sort();
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// 1. COUNTRIES ENRICHMENT
// -------------------------------------------------------------
function processCountries(letters) {
  let addedCount = 0;

  // Well-known colloquial country aliases, abbreviations & alternative names
  const countryAliases = [
    // DR Congo & Congo
    ["democratic republic of the congo", ["dr congo", "drc", "the drc", "congo kinshasa", "congo-kinshasa"]],
    ["congo", ["republic of the congo", "congo brazzaville", "congo-brazzaville"]],
    // United States
    ["united states", ["usa", "us", "united states of america", "america"]],
    // United Kingdom
    ["united kingdom", ["uk", "great britain", "britain", "england", "scotland", "wales", "northern ireland"]],
    // United Arab Emirates
    ["united arab emirates", ["uae", "the uae", "emirates"]],
    // Central African Republic
    ["central african republic", ["car"]],
    // Ivory Coast
    ["cote d'ivoire (ivory coast)", ["ivory coast", "cote divoire", "cote d'ivoire"]],
    // The Gambia
    ["gambia the", ["gambia", "the gambia"]],
    // The Bahamas
    ["bahamas", ["the bahamas"]],
    // The Netherlands / Holland
    ["netherlands", ["holland", "the netherlands"]],
    // Vatican
    ["vatican city state (holy see)", ["vatican", "vatican city", "holy see"]],
    // Micronesia
    ["micronesia, federated states of", ["micronesia"]],
    // Isle of Man
    ["man (isle of)", ["isle of man"]],
    // South Korea & North Korea
    ["korea (republic of)", ["south korea", "korea"]],
    ["korea (democratic people's republic of)", ["north korea"]],
    // Russia
    ["russian federation", ["russia"]],
    // Syria
    ["syrian arab republic", ["syria"]],
    // Iran
    ["iran (islamic republic of)", ["iran"]],
    // Laos
    ["lao people's democratic republic", ["laos"]],
    // Moldova
    ["moldova (republic of)", ["moldova"]],
    // Tanzania
    ["tanzania, united republic of", ["tanzania"]],
    // Bolivia
    ["bolivia (plurinational state of)", ["bolivia"]],
    // Venezuela
    ["venezuela (bolivarian republic of)", ["venezuela"]],
    // Vietnam
    ["viet nam", ["vietnam"]],
    // East Timor
    ["east timor", ["timor-leste", "timor leste"]],
    // Eswatini / Swaziland
    ["swaziland", ["eswatini"]],
    // Czech Republic / Czechia
    ["czech republic", ["czechia"]],
    // Saint Martin & Sint Maarten
    ["saint-martin (french part)", ["saint martin", "st martin"]],
    ["sint maarten (dutch part)", ["sint maarten", "st maarten"]],
    // Virgin Islands
    ["virgin islands (british)", ["british virgin islands", "bvi"]],
    ["virgin islands (us)", ["us virgin islands", "usvi"]],
    // Cape Verde / Cabo Verde
    ["cape verde", ["cabo verde"]],
    // Turkey / Turkiye
    ["turkey", ["turkiye"]],
    // Burma / Myanmar
    ["myanmar", ["burma"]],
    // Macedonia / North Macedonia
    ["macedonia", ["north macedonia"]],
  ];

  for (const [_, aliases] of countryAliases) {
    for (const alias of aliases) {
      if (addWordToLetters(letters, alias)) addedCount++;
    }
  }

  // Generic heuristic for countries:
  // e.g., "gambia the" -> "gambia", "the gambia"
  for (const list of Object.values(letters)) {
    for (const w of [...list]) {
      if (w.endsWith(" the")) {
        const base = w.replace(/\s+the$/, "");
        if (addWordToLetters(letters, base)) addedCount++;
        if (addWordToLetters(letters, `the ${base}`)) addedCount++;
      }
      if (w.includes(" (") && w.endsWith(")")) {
        const cleanBase = w.replace(/\s*\([^)]*\)/g, "").trim();
        if (addWordToLetters(letters, cleanBase)) addedCount++;
        const insideParen = w.match(/\(([^)]+)\)/)?.[1]?.trim();
        if (insideParen && !insideParen.includes("part") && !insideParen.includes("partial")) {
          if (addWordToLetters(letters, insideParen)) addedCount++;
        }
      }
    }
  }

  return addedCount;
}

// -------------------------------------------------------------
// 2. CURRENCIES ENRICHMENT
// -------------------------------------------------------------
function processCurrencies(letters) {
  let addedCount = 0;

  // Common universal base currency names (so people can type "naira", "yen", "dollar", "peso", etc.)
  const universalCurrencies = [
    "naira",
    "dollar",
    "euro",
    "pound",
    "yen",
    "yuan",
    "franc",
    "peso",
    "rupee",
    "ruble",
    "dinar",
    "dirham",
    "shilling",
    "shekel",
    "krona",
    "krone",
    "kwacha",
    "rand",
    "real",
    "lira",
    "baht",
    "dong",
    "won",
    "sol",
    "quetzal",
    "lempira",
    "cordoba",
    "colón",
    "colon",
    "bolivar",
    "guarani",
    "taka",
    "kyat",
    "riel",
    "kip",
    "tugrik",
    "manat",
    "tenge",
    "som",
    "somoni",
    "afghani",
    "lek",
    "kwanza",
    "dram",
    "florin",
    "ngultrum",
    "boliviano",
    "pula",
    "lev",
    "escudo",
    "pataca",
    "ouguiya",
    "birr",
    "dalasi",
    "cedi",
    "gourde",
    "forint",
    "króna",
    "kuna",
    "loti",
    "ariary",
    "rufiyaa",
    "metical",
    "kyats",
    "cordoba",
    "kina",
    "zloty",
    "dobra",
    "leone",
    "tala",
    "lilangeni",
    "vatu",
    "riyal",
    "rial",
  ];

  for (const c of universalCurrencies) {
    if (addWordToLetters(letters, c)) addedCount++;
  }

  // Automatic base extraction from compound currencies:
  // e.g. "nigerian naira" -> also index "naira"
  // "us dollar" -> also index "dollar"
  // "japanese yen" -> also index "yen"
  for (const list of Object.values(letters)) {
    for (const w of [...list]) {
      const parts = w.split(" ");
      if (parts.length >= 2) {
        const lastWord = parts[parts.length - 1];
        // If last word is a meaningful currency root (>= 3 chars)
        if (lastWord.length >= 3) {
          if (addWordToLetters(letters, lastWord)) addedCount++;
        }
        // Two-word currencies like "convertible mark", "cape verdean escudo"
        if (parts.length === 3) {
          const twoWords = `${parts[1]} ${parts[2]}`;
          if (addWordToLetters(letters, twoWords)) addedCount++;
        }
      }
    }
  }

  return addedCount;
}

// -------------------------------------------------------------
// 3. CAPITALS ENRICHMENT
// -------------------------------------------------------------
function processCapitals(letters) {
  let addedCount = 0;

  const capitalAliases = [
    // Washington D.C.
    ["washington, d.c.", ["washington", "washington dc", "dc"]],
    // Douglas, Isle of Man
    ["douglas, isle of man", ["douglas"]],
    // Saint John's
    ["saint john's", ["st johns", "st. john's", "st john's"]],
    // Saint George's
    ["saint george's", ["st georges", "st. george's", "st george's"]],
    // Kiev / Kyiv
    ["kiev", ["kyiv"]],
    // Astana / Nur-Sultan
    ["astana", ["nur-sultan", "nursultan"]],
    // Bandar Seri Begawan
    ["bandar seri begawan", ["bandar"]],
  ];

  for (const [_, aliases] of capitalAliases) {
    for (const alias of aliases) {
      if (addWordToLetters(letters, alias)) addedCount++;
    }
  }

  // Clean trailing commas or country descriptors: e.g. "douglas, isle of man" -> "douglas"
  for (const list of Object.values(letters)) {
    for (const w of [...list]) {
      if (w.includes(",")) {
        const base = w.split(",")[0].trim();
        if (addWordToLetters(letters, base)) addedCount++;
      }
      if (w.startsWith("saint ")) {
        const st = w.replace(/^saint\s+/, "st ");
        if (addWordToLetters(letters, st)) addedCount++;
      }
    }
  }

  return addedCount;
}

// -------------------------------------------------------------
// 4. STATES / PROVINCES ENRICHMENT
// -------------------------------------------------------------
function processStates(letters) {
  let addedCount = 0;

  // Heuristic cleanup for states:
  // e.g. "abuja federal capital territory" -> "abuja"
  // "abu dhabi emirate" -> "abu dhabi"
  // "abim district" -> "abim"
  // "achaea regional unit" -> "achaea"
  // "famagusta district (magusa)" -> "famagusta", "magusa"
  const descriptors = [
    " federal capital territory",
    " capital territory",
    " regional unit",
    " autonomous region",
    " autonomous community",
    " autonomous province",
    " special administrative region",
    " metropolitan city",
    " department",
    " prefecture",
    " province",
    " district",
    " division",
    " emirate",
    " governorate",
    " municipality",
    " state",
    " region",
    " county",
    " canton",
    " parish",
  ];

  for (const list of Object.values(letters)) {
    for (const w of [...list]) {
      // Remove trailing parenthetical or extract alias
      if (w.includes(" (") && w.endsWith(")")) {
        const cleanBase = w.replace(/\s*\([^)]*\)/g, "").trim();
        if (addWordToLetters(letters, cleanBase)) addedCount++;
        const insideParen = w.match(/\(([^)]+)\)/)?.[1]?.trim();
        if (insideParen && !insideParen.includes("eh-") && insideParen.length >= 3) {
          if (addWordToLetters(letters, insideParen)) addedCount++;
        }
      }

      // Check descriptor stripping
      for (const desc of descriptors) {
        if (w.endsWith(desc)) {
          const stripped = w.slice(0, -desc.length).trim();
          if (stripped.length >= 3) {
            if (addWordToLetters(letters, stripped)) addedCount++;
          }
        }
      }
    }
  }

  return addedCount;
}

// -------------------------------------------------------------
// MAIN RUNNER
// -------------------------------------------------------------
function main() {
  console.log("=== Category Dataset Alias Expansion ===");

  const targetFiles = [
    { file: "countries.json", processor: processCountries },
    { file: "currencies.json", processor: processCurrencies },
    { file: "capitals.json", processor: processCapitals },
    { file: "states.json", processor: processStates },
  ];

  let grandTotalAdded = 0;
  const newStats = {};

  for (const { file, processor } of targetFiles) {
    const filePath = path.join(categoriesDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!data.letters) data.letters = {};

    const beforeCount = Object.values(data.letters).reduce((sum, arr) => sum + arr.length, 0);
    const added = processor(data.letters);
    const afterCount = Object.values(data.letters).reduce((sum, arr) => sum + arr.length, 0);

    // Sort letters alphabetically and items alphabetically
    const sortedLetters = {};
    for (const letter of Object.keys(data.letters).sort()) {
      sortedLetters[letter] = Array.from(new Set(data.letters[letter])).sort();
    }
    data.letters = sortedLetters;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`[${file}] Added ${added} aliases (Total: ${beforeCount} -> ${afterCount})`);
    grandTotalAdded += added;
  }

  // Update metadata.json
  if (fs.existsSync(metadataPath)) {
    try {
      const allCategoryFiles = fs.readdirSync(categoriesDir).filter((f) => f.endsWith(".json"));
      let totalWords = 0;
      const stats = {};

      for (const catFile of allCategoryFiles) {
        const catData = JSON.parse(fs.readFileSync(path.join(categoriesDir, catFile), "utf-8"));
        const catCount = Object.values(catData.letters || {}).reduce((s, a) => s + a.length, 0);
        const catKey = catData.category || path.basename(catFile, ".json");
        stats[catKey.toLowerCase()] = catCount;
        totalWords += catCount;
      }

      const meta = {
        lastSync: new Date().toISOString(),
        totalWords,
        categoriesCount: allCategoryFiles.length,
        stats,
      };

      fs.writeFileSync(metadataPath, JSON.stringify(meta, null, 2), "utf-8");
      console.log(`Updated metadata.json: ${totalWords} total words across ${allCategoryFiles.length} categories.`);
    } catch (err) {
      console.error("Failed to update metadata.json:", err);
    }
  }

  console.log(`\n🎉 Success! Added ${grandTotalAdded} alias/colloquial words across category datasets.`);
}

main();
