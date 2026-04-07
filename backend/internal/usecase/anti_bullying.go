package usecase

import (
	"regexp"
	"strings"
)

var moderationCleanupPattern = regexp.MustCompile(`[^\p{L}\p{N}\s]+`)

func compilePhrasePatterns(phrases []string) []*regexp.Regexp {
	patterns := make([]*regexp.Regexp, 0, len(phrases))
	for _, phrase := range phrases {
		patterns = append(patterns, regexp.MustCompile(`(^| )`+regexp.QuoteMeta(phrase)+`( |$)`))
	}
	return patterns
}

func compilePrefixPatterns(prefixes []string) []*regexp.Regexp {
	patterns := make([]*regexp.Regexp, 0, len(prefixes))
	for _, prefix := range prefixes {
		patterns = append(patterns, regexp.MustCompile(`(^| )`+regexp.QuoteMeta(prefix)+`[\p{L}\p{N}]*( |$)`))
	}
	return patterns
}

var abusivePhrasePatterns = append(
	compilePhrasePatterns(ruPhraseBanwords),
	compilePhrasePatterns(enPhraseBanwords)...,
)

var abusivePrefixPatterns = append(
	compilePrefixPatterns(ruWordPrefixBanwords),
	compilePrefixPatterns(enWordPrefixBanwords)...,
)

func normalizeForModeration(text string) string {
	normalized := strings.ToLower(strings.ReplaceAll(text, "ё", "е"))
	normalized = moderationCleanupPattern.ReplaceAllString(normalized, " ")
	return strings.Join(strings.Fields(normalized), " ")
}

func containsAbusiveLanguage(text string) bool {
	normalizedText := normalizeForModeration(text)
	if normalizedText == "" {
		return false
	}

	for _, pattern := range abusivePhrasePatterns {
		if pattern.MatchString(normalizedText) {
			return true
		}
	}

	for _, pattern := range abusivePrefixPatterns {
		if pattern.MatchString(normalizedText) {
			return true
		}
	}

	return false
}
