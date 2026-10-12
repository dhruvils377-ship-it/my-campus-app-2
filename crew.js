// Pure "My Crew" name-handling logic — no React, no localStorage, no hooks.
// Kept separate from the CrewPanel component so the tricky bit (what counts
// as a duplicate name) can be unit-tested directly (see crew.test.js).

export const MAX_CREW = 20;

// Normalizes for comparison only (never for storage/display): collapses
// internal whitespace, trims, lowercases, and strips diacritics so "Álex",
// "alex", and "Alex" are treated as the same name, and "Al  ex" matches
// "Al ex" instead of sneaking past as a distinct entry.
export function normalizeNameForCompare(s) {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Cleans a raw name for storage: trims, collapses internal whitespace, caps
// length. Does NOT lowercase or strip diacritics — that's only for comparison.
export function cleanCrewName(raw, maxLength = 30) {
  return raw.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

// Returns true if `name` collides (after normalization) with any member in
// `crew`, optionally excluding one id (used when renaming, so a member isn't
// flagged as a duplicate of itself).
export function isDuplicateName(crew, name, excludeId = null) {
  const target = normalizeNameForCompare(name);
  return crew.some(
    (c) => c.id !== excludeId && normalizeNameForCompare(c.name) === target
  );
}

export function isCrewFull(crew, max = MAX_CREW) {
  return crew.length >= max;
}