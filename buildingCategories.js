// Groups BUILDINGS into labeled sections for the manual-location picker.
// osmBuildings already carry a `cat` field; legacyBuildings don't, so those
// fall back to a keyword guess against the name/key. Order of the keyword
// checks matters — most specific first — so e.g. "medical parking" lands in
// Parking, not Health.
export const CATEGORY_ORDER = ['academic', 'food', 'sports', 'hostel', 'health', 'parking', 'poi'];

export const CATEGORY_LABELS = {
  academic: 'Academic',
  food: 'Food & Dining',
  sports: 'Sports & Recreation',
  hostel: 'Hostel',
  health: 'Health & Medical',
  parking: 'Parking',
  poi: 'Landmarks & Other',
};

const KEYWORD_RULES = [
  ['parking', /parking/],
  ['hostel', /bhavan|bhawan|hostel/],
  ['food', /canteen|cafeteria|food ?court|\btea\b|pizza|domino|kathi|crust|\bsalt\b/],
  ['sports', /\bgym\b|ground|court|kabaddi|stadium/],
  ['health', /hospital|dispensary/],
  ['academic', /institute|\bblock\b|faculty|\bppt\b|\bppi\b|school|college|polytechnic|workshop|\blibrary\b|auditorium/],
];

// osm `cat: "building"` is too generic to show as its own section — fold it
// into Landmarks & Other alongside gates, circles, temples, etc.
function normalizeCat(cat) {
  if (!cat || cat === 'building') return null;
  return cat;
}

export function categorizeBuilding(key, building) {
  const fromData = normalizeCat(building.cat);
  if (fromData) return fromData;
  const haystack = `${key} ${building.name}`.toLowerCase();
  for (const [cat, re] of KEYWORD_RULES) {
    if (re.test(haystack)) return cat;
  }
  return 'poi';
}

// Returns [{ cat, label, items: [{key, name}] }, ...] in CATEGORY_ORDER,
// skipping empty sections. `items` within a section are sorted by name.
export function groupBuildingsByCategory(buildings) {
  const buckets = {};
  for (const [key, b] of Object.entries(buildings)) {
    const cat = categorizeBuilding(key, b);
    (buckets[cat] ||= []).push({ key, name: b.name });
  }
  return CATEGORY_ORDER
    .filter(cat => buckets[cat]?.length)
    .map(cat => ({
      cat,
      label: CATEGORY_LABELS[cat],
      items: buckets[cat].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

// Flat, case-insensitive name/key search across all buildings — used by the
// picker's search box instead of the category view once the user types.
export function searchBuildings(buildings, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return Object.entries(buildings)
    .filter(([key, b]) => b.name.toLowerCase().includes(q) || key.includes(q))
    .map(([key, b]) => ({ key, name: b.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}