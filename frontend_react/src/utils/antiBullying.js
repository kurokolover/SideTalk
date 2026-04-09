import { antiBullyingDictionary } from "../shared/banwords.js";

const LATIN_TO_CYRILLIC = {
  a: "а",
  b: "в",
  c: "с",
  e: "е",
  h: "н",
  k: "к",
  m: "м",
  o: "о",
  p: "р",
  t: "т",
  x: "х",
  y: "у",
};

const CYRILLIC_TO_LATIN = {
  а: "a",
  в: "b",
  с: "c",
  е: "e",
  н: "h",
  к: "k",
  м: "m",
  о: "o",
  р: "p",
  т: "t",
  х: "x",
  у: "y",
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeWhitespace = (text) =>
  text
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const mapLookalikes = (text, replacementMap) =>
  Array.from(text, (char) => replacementMap[char] || char).join("");

const normalizeBase = (text) =>
  normalizeWhitespace(text.toLowerCase().replace(/ё/g, "е"));

const normalizeForLocale = (text, locale) => {
  const base = normalizeBase(text);

  if (locale === "ru") {
    return mapLookalikes(base, LATIN_TO_CYRILLIC);
  }

  if (locale === "en") {
    return mapLookalikes(base, CYRILLIC_TO_LATIN);
  }

  return base;
};

const uniqueNormalizedEntries = (entries, locale) =>
  Array.from(
    new Set(entries.map((entry) => normalizeForLocale(entry, locale)).filter(Boolean))
  );

const compilePhrasePatterns = (entries, locale) =>
  uniqueNormalizedEntries(entries, locale).map(
    (entry) => new RegExp(`(^|\\s)${escapeRegex(entry)}(\\s|$)`, "u")
  );

const compilePrefixPatterns = (entries, locale) =>
  uniqueNormalizedEntries(entries, locale).map(
    (entry) => new RegExp(`(^|\\s)${escapeRegex(entry)}[\\p{L}\\p{N}]*(\\s|$)`, "u")
  );

const ruPhrasePatterns = compilePhrasePatterns(antiBullyingDictionary.phrases.ru, "ru");
const enPhrasePatterns = compilePhrasePatterns(antiBullyingDictionary.phrases.en, "en");
const ruPrefixPatterns = compilePrefixPatterns(antiBullyingDictionary.wordPrefixes.ru, "ru");
const enPrefixPatterns = compilePrefixPatterns(antiBullyingDictionary.wordPrefixes.en, "en");

export function containsAbusiveLanguage(text) {
  const normalizedRu = normalizeForLocale(text, "ru");
  const normalizedEn = normalizeForLocale(text, "en");

  if (!normalizedRu && !normalizedEn) {
    return false;
  }

  return (
    ruPhrasePatterns.some((pattern) => pattern.test(normalizedRu)) ||
    enPhrasePatterns.some((pattern) => pattern.test(normalizedEn)) ||
    ruPrefixPatterns.some((pattern) => pattern.test(normalizedRu)) ||
    enPrefixPatterns.some((pattern) => pattern.test(normalizedEn))
  );
}

export function normalizeMessageForModeration(text) {
  return normalizeBase(text);
}
