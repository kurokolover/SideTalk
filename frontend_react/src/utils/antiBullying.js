import { antiBullyingDictionary } from "../shared/banwords";

const normalizeForModeration = (text) =>
  text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const phrasePatterns = [
  ...antiBullyingDictionary.phrases.ru,
  ...antiBullyingDictionary.phrases.en,
].map((phrase) => new RegExp(`(^|\\s)${escapeRegex(phrase)}(\\s|$)`, "u"));

const wordPrefixPatterns = [
  ...antiBullyingDictionary.wordPrefixes.ru,
  ...antiBullyingDictionary.wordPrefixes.en,
].map((prefix) => new RegExp(`(^|\\s)${escapeRegex(prefix)}[\\p{L}\\p{N}]*(\\s|$)`, "u"));

export function containsAbusiveLanguage(text) {
  const normalizedText = normalizeForModeration(text);

  if (!normalizedText) {
    return false;
  }

  return (
    phrasePatterns.some((pattern) => pattern.test(normalizedText)) ||
    wordPrefixPatterns.some((pattern) => pattern.test(normalizedText))
  );
}

export function normalizeMessageForModeration(text) {
  return normalizeForModeration(text);
}
