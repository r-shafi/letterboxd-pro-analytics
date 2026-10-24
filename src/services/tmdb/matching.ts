/**
 * TMDb Matching Engine
 * Multi-tier title normalization, similarity scoring, tie-breaking, and confidence classification.
 */

import { TmdbMatchCandidate, MatchConfidence, MatchReviewReason, Film, TmdbMatchResult } from '../../types/domain.ts';

export const MATCH_RULES_VERSION = 2;

const LEADING_ARTICLES = /^(the|a|an|la|le|les|der|die|das|el|il|un|une)\s+|^l['’]/i;

const ROMAN_NUMERALS: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10
};

/**
 * Normalizes title for comparison: strips accents, symbols, roman numerals, leading articles, lowers case.
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/^l['’]/i, '') // remove leading l' elision
    .replace(/&/g, ' and ')
    .replace(/[^\w\s]/g, ' ') // remove punctuation
    .replace(LEADING_ARTICLES, '') // remove leading article
    .replace(/\b(part|vol|volume)\s+([ivxlcdm]+)\b/gi, (match, prefix, roman) => {
      const num = ROMAN_NUMERALS[roman.toLowerCase()];
      return num ? `${prefix} ${num}` : match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts base title before subtitle separators (colon, dash)
 */
export function stripSubtitle(title: string): string | null {
  if (!title) return null;
  const parts = title.split(/[:\-–—]/);
  if (parts.length > 1 && parts[0].trim().length >= 2) {
    return parts[0].trim();
  }
  return null;
}

/**
 * Jaro-Winkler string similarity (returns 0.0 to 1.0).
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);

    for (let j = start; j < end; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix adjustment
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Deterministic tie-breaker when two or more TMDb entries share exact title and year.
 * Prefers the candidate with substantially higher vote count, popularity, and poster.
 */
export function candidateTieBreaker(
  cand1: TmdbMatchCandidate,
  cand2: TmdbMatchCandidate
): boolean {
  const v1 = cand1.voteCount || 0;
  const v2 = cand2.voteCount || 0;
  const p1 = cand1.popularity || 0;
  const p2 = cand2.popularity || 0;
  const hasPoster1 = Boolean(cand1.posterPath);

  // Substantial vote count gap (>= 50 votes vs < 15 votes, or >= 10x difference when v1 >= 500)
  if (v1 >= 50 && v2 < 15 && p1 >= p2 && hasPoster1) {
    return true;
  }
  if (v1 >= 500 && v1 >= v2 * 10 && hasPoster1) {
    return true;
  }

  return false;
}

/**
 * Calculates matching score (0.0 to 1.0) between query and candidate.
 * Guarantees that partial/containment matches can never reach exact match tier.
 */
export function scoreCandidate(
  targetTitle: string,
  targetYear: number | undefined,
  candidateTitle: string,
  candidateOriginalTitle: string,
  candidateYear?: number,
  candidatePopularity = 0
): number {
  const normTarget = normalizeTitle(targetTitle);
  const normCandidate = normalizeTitle(candidateTitle);
  const normOriginal = normalizeTitle(candidateOriginalTitle);

  // Highest similarity between title and originalTitle
  const titleSim1 = jaroWinklerSimilarity(normTarget, normCandidate);
  const titleSim2 = jaroWinklerSimilarity(normTarget, normOriginal);
  const titleSimilarity = Math.max(titleSim1, titleSim2);

  const isExactTitle = normTarget === normCandidate || normTarget === normOriginal;
  const isExactYear = targetYear !== undefined && candidateYear === targetYear;
  const isYearOffByOne =
    targetYear !== undefined && candidateYear !== undefined && Math.abs(targetYear - candidateYear) === 1;

  // Exact normalized title matches
  if (isExactTitle) {
    if (isExactYear) return 1.0;
    if (isYearOffByOne) return 0.90;
    if (targetYear === undefined) return 0.95;
    return 0.80; // Exact title but year difference >= 2
  }

  // Non-exact title: partial, containment, or typo matches
  // Strictly capped at <= 0.75 so containment never rivals an exact match
  let yearWeight = 0.05;
  if (isExactYear) yearWeight = 0.20;
  else if (isYearOffByOne) yearWeight = 0.12;

  const popBonus = Math.min(0.05, Math.log10(Math.max(1, candidatePopularity)) / 10);
  const rawScore = titleSimilarity * 0.50 + yearWeight + popBonus;

  return Math.min(0.75, rawScore);
}

/**
 * Classifies match outcome into Confident, Ambiguous, or Unmatched with explicit reason.
 */
export function classifyCandidates(
  candidates: TmdbMatchCandidate[],
  targetTitle?: string,
  targetYear?: number
): {
  status: MatchConfidence;
  topCandidate?: TmdbMatchCandidate;
  reason: MatchReviewReason;
  approximateYear?: boolean;
} {
  if (candidates.length === 0) {
    return { status: 'unmatched', reason: 'unmatched' };
  }

  const sorted = [...candidates].sort((a, b) => b.confidenceScore - a.confidenceScore);
  const top = sorted[0];

  if (targetTitle) {
    const normTarget = normalizeTitle(targetTitle);

    // Check exact title and exact year candidates
    const exactBoth = sorted.filter((c) => {
      const isExact =
        normalizeTitle(c.title) === normTarget || normalizeTitle(c.originalTitle) === normTarget;
      return isExact && targetYear !== undefined && c.year === targetYear;
    });

    if (exactBoth.length === 1) {
      return {
        status: 'confident',
        topCandidate: exactBoth[0],
        reason: 'exact_title_and_year'
      };
    }

    if (exactBoth.length > 1) {
      if (candidateTieBreaker(exactBoth[0], exactBoth[1])) {
        return {
          status: 'confident',
          topCandidate: exactBoth[0],
          reason: 'exact_tie_breaker'
        };
      }
      return {
        status: 'ambiguous',
        topCandidate: exactBoth[0],
        reason: 'same_title_duplicates'
      };
    }

    // Check year off by one (approximate year)
    if (targetYear !== undefined) {
      const exactOffByOne = sorted.filter((c) => {
        const isExact =
          normalizeTitle(c.title) === normTarget || normalizeTitle(c.originalTitle) === normTarget;
        return isExact && c.year !== undefined && Math.abs(c.year - targetYear) === 1;
      });

      if (exactOffByOne.length === 1) {
        return {
          status: 'confident',
          topCandidate: exactOffByOne[0],
          reason: 'approximate_year',
          approximateYear: true
        };
      }
    }
  }

  // Fallback scoring classification
  if (top.confidenceScore < 0.65) {
    return {
      status: 'unmatched',
      topCandidate: top,
      reason: 'no_plausible_match'
    };
  }

  if (sorted.length > 1) {
    const second = sorted[1];
    const margin = top.confidenceScore - second.confidenceScore;
    if (top.confidenceScore >= 0.85 && margin >= 0.15) {
      return {
        status: 'confident',
        topCandidate: top,
        reason: 'high_score_clear_margin'
      };
    }
    return {
      status: 'ambiguous',
      topCandidate: top,
      reason: 'no_confident_match'
    };
  }

  // Single candidate with acceptable confidence
  if (top.confidenceScore >= 0.85) {
    return {
      status: 'confident',
      topCandidate: top,
      reason: 'high_score_clear_margin'
    };
  }

  return {
    status: 'ambiguous',
    topCandidate: top,
    reason: 'no_confident_match'
  };
}

/**
 * Re-scores a film's match using cached candidates and updated rules without network calls.
 */
export function rescoreFilmMatch(film: Film): TmdbMatchResult {
  if (film.match.manuallyOverridden) {
    return film.match;
  }

  const existingCandidates = film.match.candidates;
  if (!existingCandidates || existingCandidates.length === 0) {
    return {
      ...film.match,
      status: film.match.status,
      matchRulesVersion: MATCH_RULES_VERSION
    };
  }

  // Re-score each candidate against target film name and year
  const rescoredCandidates = existingCandidates.map((c) => {
    const score = scoreCandidate(
      film.name,
      film.year,
      c.title,
      c.originalTitle,
      c.year,
      c.popularity || 0
    );
    return {
      ...c,
      confidenceScore: score
    };
  });

  rescoredCandidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
  const classification = classifyCandidates(rescoredCandidates, film.name, film.year);

  return {
    status: classification.status,
    tmdbId: classification.topCandidate?.id,
    score: classification.topCandidate?.confidenceScore,
    candidates: rescoredCandidates,
    reason: classification.reason,
    approximateYear: classification.approximateYear,
    matchRulesVersion: MATCH_RULES_VERSION,
    manuallyOverridden: false
  };
}
