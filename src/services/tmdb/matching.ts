/**
 * TMDb Matching Engine
 * Multi-tier title normalization, similarity scoring, and confidence classification.
 */

import { TmdbMatchCandidate, MatchConfidence } from '../../types/domain.ts';

const LEADING_ARTICLES = /^(the|a|an|la|le|les|der|die|das|el|il|un|une)\s+/i;

/**
 * Normalizes title for comparison: strips accents, symbols, leading articles, lowers case.
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s]/g, ' ') // remove punctuation
    .replace(LEADING_ARTICLES, '') // remove leading article
    .replace(/\s+/g, ' ')
    .trim();
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
 * Calculates matching score (0.0 to 1.0) between query and candidate.
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

  // Exact title bonus
  const exactTitle = normTarget === normCandidate || normTarget === normOriginal;

  // Year similarity
  let yearSimilarity = 0.5;
  if (targetYear !== undefined && candidateYear !== undefined) {
    const diff = Math.abs(targetYear - candidateYear);
    if (diff === 0) yearSimilarity = 1.0;
    else if (diff === 1) yearSimilarity = 0.85;
    else if (diff === 2) yearSimilarity = 0.6;
    else if (diff <= 5) yearSimilarity = 0.3;
    else yearSimilarity = 0.05;
  } else if (targetYear === undefined) {
    yearSimilarity = 0.8;
  }

  // Popularity soft dampener (0 to 0.05)
  const popBonus = Math.min(0.05, (Math.log10(Math.max(1, candidatePopularity)) / 10));

  let finalScore = titleSimilarity * 0.65 + yearSimilarity * 0.30 + popBonus;
  if (exactTitle && yearSimilarity >= 0.85) {
    finalScore = Math.max(finalScore, 0.95);
  }

  return Math.min(1.0, finalScore);
}

/**
 * Classifies match outcome into Confident, Ambiguous, or Unmatched.
 */
export function classifyCandidates(
  candidates: TmdbMatchCandidate[]
): { status: MatchConfidence; topCandidate?: TmdbMatchCandidate } {
  if (candidates.length === 0) {
    return { status: 'unmatched' };
  }

  const sorted = [...candidates].sort((a, b) => b.confidenceScore - a.confidenceScore);
  const top = sorted[0];

  if (top.confidenceScore < 0.65) {
    return { status: 'unmatched', topCandidate: top };
  }

  // Check margin over second match if exists
  if (sorted.length > 1) {
    const second = sorted[1];
    const margin = top.confidenceScore - second.confidenceScore;

    // Confident: high score (>= 0.88) and clear margin (>= 0.10)
    if (top.confidenceScore >= 0.88 && margin >= 0.10) {
      return { status: 'confident', topCandidate: top };
    }

    // Ambiguous if top score is modest or close contest
    return { status: 'ambiguous', topCandidate: top };
  }

  // Single candidate
  if (top.confidenceScore >= 0.85) {
    return { status: 'confident', topCandidate: top };
  }

  return { status: 'ambiguous', topCandidate: top };
}
