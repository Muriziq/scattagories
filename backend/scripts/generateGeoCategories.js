import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categoriesDir = path.resolve(__dirname, "../data/categories");
const metadataPath = path.resolve(__dirname, "../data/metadata.json");
const countriesPath = path.resolve(__dirname, "countriesDataWithId.json");

// Normalization matching ScatterBlitz engine:
// Lowercase, remove diacritics, strip leading non-alphanumeric chars, trim whitespace
function normalizeWord(str) {
  if (!str) return "";
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^a-z0-9]/i, "")
    .replace(/\s+/g, " ");
}

function getFirstLetter(str) {
  const norm = normalizeWord(str);
  if (!norm) return null;
  const ch = norm[0].toUpperCase();
  return /^[A-Z]$/.test(ch) ? ch : null;
}

function createLettersMap(words) {
  const map = {};
  for (let c = 65; c <= 90; c++) {
    map[String.fromCharCode(c)] = new Set();
  }
  for (const w of words) {
    const clean = normalizeWord(w);
    if (!clean || clean.length < 2) continue;
    const first = clean[0]?.toUpperCase();
    if (first >= "A" && first <= "Z") {
      map[first].add(clean);
    }
  }
  const result = {};
  for (let c = 65; c <= 90; c++) {
    const ch = String.fromCharCode(c);
    result[ch] = Array.from(map[ch]).sort();
  }
  return result;
}

function saveCategoryJson(fileName, categoryName, wordsSet) {
  const letters = createLettersMap(wordsSet);
  let totalWords = 0;
  for (const arr of Object.values(letters)) {
    totalWords += arr.length;
  }
  const output = {
    category: categoryName,
    updatedAt: new Date().toISOString(),
    wordCount: totalWords,
    letters,
  };
  const filePath = path.join(categoriesDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2), "utf8");
  console.log(`✓ Saved ${fileName}: ${totalWords} words`);
  return totalWords;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("==================================================");
  console.log("  ScatterBlitz Geographic Data Synchronizer");
  console.log("  (Countries, Capitals, Currencies, States, Cities)");
  console.log("==================================================\n");

  if (!fs.existsSync(categoriesDir)) {
    fs.mkdirSync(categoriesDir, { recursive: true });
  }

  // 1. Load local country catalog with IDs
  const countriesRaw = JSON.parse(fs.readFileSync(countriesPath, "utf8"));
  const countriesList = countriesRaw.countries || [];
  console.log(`Loaded ${countriesList.length} countries from countriesDataWithId.json`);

  const countriesSet = new Set();
  const capitalsSet = new Set();
  const currenciesSet = new Set();
  const statesSet = new Set();
  const citiesSet = new Set();

  // Extract from countriesDataWithId.json (Country names, Capitals, Currencies)
  for (const c of countriesList) {
    if (c.name) countriesSet.add(c.name);
    if (c.capital) capitalsSet.add(c.capital);
    if (c.currency) currenciesSet.add(c.currency); // Currency code (e.g. USD, EUR)
    if (c.currency_name) currenciesSet.add(c.currency_name); // Currency name (e.g. US Dollar)

    // Parse native/translations if available
    if (c.translations) {
      try {
        const trans = JSON.parse(c.translations);
        for (const t of Object.values(trans)) {
          if (typeof t === "string") countriesSet.add(t);
        }
      } catch (_) {}
    }
  }

  // Common colloquial country aliases so players can type standard synonyms
  const countryAliases = [
    "usa", "america", "united states of america",
    "uk", "britain", "great britain", "england", "scotland", "wales", "northern ireland",
    "uae", "the uae", "emirates",
    "drc", "dr congo", "congo kinshasa", "congo brazzaville",
    "the gambia", "the bahamas", "holland", "the netherlands",
    "vatican", "vatican city", "holy see",
    "south korea", "north korea", "russia", "syria", "iran", "laos", "moldova", "tanzania", "bolivia", "venezuela", "vietnam"
  ];
  for (const alias of countryAliases) countriesSet.add(alias);

  // Common currency nicknames/slang recognized in Scattergories
  const currencyAliases = ["buck", "bucks", "quid", "grand", "dime", "nickel", "penny", "cent", "cents", "pence"];
  for (const alias of currencyAliases) currenciesSet.add(alias);

  // 2. Fetch States dataset
  console.log("\nFetching global States dataset...");
  try {
    const statesRes = await fetch("https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/states.json");
    if (statesRes.ok) {
      const statesData = await statesRes.json();
      for (const s of statesData) {
        if (s.name) statesSet.add(s.name);
      }
      console.log(`✓ Fetched ${statesData.length} global states/provinces`);
    }
  } catch (err) {
    console.warn("Could not fetch states dataset remotely:", err.message);
  }

  // 3. Fetch Cities dataset (countries+cities)
  console.log("\nFetching global Cities dataset (137,000+ cities)...");
  try {
    const citiesRes = await fetch("https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries%2Bcities.json");
    if (citiesRes.ok) {
      const citiesData = await citiesRes.json();
      for (const item of citiesData) {
        if (Array.isArray(item.cities)) {
          for (const city of item.cities) {
            citiesSet.add(city);
          }
        }
      }
      console.log(`✓ Fetched complete countries+cities dataset`);
    }
  } catch (err) {
    console.warn("Could not fetch cities dataset remotely:", err.message);
  }

  // 4. Sample check against csc.sidsworld.co.in API with rate-limiting
  console.log("\nQuerying csc.sidsworld.co.in API for verification (with 500ms delay)...");
  for (let i = 0; i < Math.min(countriesList.length, 10); i++) {
    const c = countriesList[i];
    try {
      const res = await fetch(`https://csc.sidsworld.co.in/public/api/citiesByCountry/${c.id}`);
      if (res.ok) {
        const json = await res.json();
        const list = json.cities?.data || (Array.isArray(json.cities) ? json.cities : []);
        for (const item of list) {
          if (item.name) citiesSet.add(item.name);
        }
      }
    } catch (_) {}
    await sleep(500);
  }

  // 5. Save all 5 category files
  console.log("\nSaving normalized category JSON files...");
  const countryCount = saveCategoryJson("countries.json", "Countries", countriesSet);
  const capitalCount = saveCategoryJson("capitals.json", "Capitals", capitalsSet);
  const currencyCount = saveCategoryJson("currencies.json", "Currencies", currenciesSet);
  const stateCount = saveCategoryJson("states.json", "States", statesSet);
  const cityCount = saveCategoryJson("cities.json", "Cities", citiesSet);

  // 6. Update metadata.json
  const totalCount = countryCount + capitalCount + currencyCount + stateCount + cityCount;
  const metadata = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, "utf8")) : { stats: {} };
  metadata.lastSync = new Date().toISOString();
  metadata.stats = {
    ...(metadata.stats || {}),
    countries: countryCount,
    capitals: capitalCount,
    currencies: currencyCount,
    states: stateCount,
    cities: cityCount,
  };
  metadata.totalWords = Object.values(metadata.stats).reduce((a, b) => a + b, 0);
  metadata.categoriesCount = Object.keys(metadata.stats).length;
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
  console.log(`✓ Updated metadata.json (Total Words: ${metadata.totalWords}, Categories: ${metadata.categoriesCount})`);

  console.log("\n==================================================");
  console.log("  All Geographic Categories Synchronized Successfully!");
  console.log("==================================================");
}

main().catch(console.error);
