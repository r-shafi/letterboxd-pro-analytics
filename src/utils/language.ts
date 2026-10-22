let languageDisplayNames: Intl.DisplayNames | null = null;
try {
  languageDisplayNames = new Intl.DisplayNames(['en'], { type: 'language' });
} catch {
  languageDisplayNames = null;
}

/**
 * Converts an ISO 639-1 language code into a full, localized English name
 * (e.g., 'ko' -> 'Korean', 'fr' -> 'French', 'ja' -> 'Japanese').
 */
export function getFullLanguageName(isoCode: string | undefined | null): string {
  if (!isoCode) return 'Unknown';
  const clean = isoCode.toLowerCase().trim();
  if (clean === 'cn') return 'Cantonese';
  if (clean === 'xx') return 'No Language';
  if (clean === 'und') return 'Unknown';

  try {
    return languageDisplayNames?.of(clean) || clean.toUpperCase();
  } catch {
    return clean.toUpperCase();
  }
}
