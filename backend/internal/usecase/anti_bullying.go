package usecase

import (
	"regexp"
	"strings"
)

var moderationCleanupPattern = regexp.MustCompile(`[^\p{L}\p{N}\s]+`)

var latinToCyrillicLookalikes = strings.NewReplacer(
	"a", "а",
	"b", "в",
	"c", "с",
	"e", "е",
	"h", "н",
	"k", "к",
	"m", "м",
	"o", "о",
	"p", "р",
	"t", "т",
	"x", "х",
	"y", "у",
)

var cyrillicToLatinLookalikes = strings.NewReplacer(
	"а", "a",
	"в", "b",
	"с", "c",
	"е", "e",
	"н", "h",
	"к", "k",
	"м", "m",
	"о", "o",
	"р", "p",
	"т", "t",
	"х", "x",
	"у", "y",
)

func normalizeBase(text string) string {
	normalized := strings.ToLower(strings.ReplaceAll(text, "ё", "е"))
	normalized = moderationCleanupPattern.ReplaceAllString(normalized, " ")
	return strings.Join(strings.Fields(normalized), " ")
}

func normalizeForLocale(text string, locale string) string {
	base := normalizeBase(text)

	switch locale {
	case "ru":
		return latinToCyrillicLookalikes.Replace(base)
	case "en":
		return cyrillicToLatinLookalikes.Replace(base)
	default:
		return base
	}
}

func uniqueNormalizedEntries(entries []string, locale string) []string {
	seen := make(map[string]struct{}, len(entries))
	result := make([]string, 0, len(entries))

	for _, entry := range entries {
		normalized := normalizeForLocale(entry, locale)
		if normalized == "" {
			continue
		}

		if _, exists := seen[normalized]; exists {
			continue
		}

		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}

	return result
}

func compilePhrasePatterns(phrases []string, locale string) []*regexp.Regexp {
	normalizedEntries := uniqueNormalizedEntries(phrases, locale)
	patterns := make([]*regexp.Regexp, 0, len(normalizedEntries))

	for _, phrase := range normalizedEntries {
		patterns = append(patterns, regexp.MustCompile(`(^| )`+regexp.QuoteMeta(phrase)+`( |$)`))
	}

	return patterns
}

func compilePrefixPatterns(prefixes []string, locale string) []*regexp.Regexp {
	normalizedEntries := uniqueNormalizedEntries(prefixes, locale)
	patterns := make([]*regexp.Regexp, 0, len(normalizedEntries))

	for _, prefix := range normalizedEntries {
		patterns = append(patterns, regexp.MustCompile(`(^| )`+regexp.QuoteMeta(prefix)+`[\p{L}\p{N}]*( |$)`))
	}

	return patterns
}

var abusiveRuPhrasePatterns = compilePhrasePatterns(ruPhraseBanwords, "ru")
var abusiveEnPhrasePatterns = compilePhrasePatterns(enPhraseBanwords, "en")
var abusiveRuPrefixPatterns = compilePrefixPatterns(ruWordPrefixBanwords, "ru")
var abusiveEnPrefixPatterns = compilePrefixPatterns(enWordPrefixBanwords, "en")

func containsAbusiveLanguage(text string) bool {
	normalizedRu := normalizeForLocale(text, "ru")
	normalizedEn := normalizeForLocale(text, "en")

	if normalizedRu == "" && normalizedEn == "" {
		return false
	}

	for _, pattern := range abusiveRuPhrasePatterns {
		if pattern.MatchString(normalizedRu) {
			return true
		}
	}

	for _, pattern := range abusiveEnPhrasePatterns {
		if pattern.MatchString(normalizedEn) {
			return true
		}
	}

	for _, pattern := range abusiveRuPrefixPatterns {
		if pattern.MatchString(normalizedRu) {
			return true
		}
	}

	for _, pattern := range abusiveEnPrefixPatterns {
		if pattern.MatchString(normalizedEn) {
			return true
		}
	}

	return false
}
