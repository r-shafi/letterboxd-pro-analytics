/**
 * Letterboxd CSV Parser & Data Normalizer
 * Pure, robust parsing by column header names with multi-line quote support,
 * BOM stripping, CRLF normalization, privacy filtering, and date verification.
 */

import Papa from 'papaparse';
import {
  Film,
  Entry,
  FilmList,
  ListItem,
  Profile,
  ImportReport,
  ImportFileReport,
  IngestionState
} from '../../types/domain.ts';
import { parseCalendarDate } from '../../utils/date.ts';

/**
 * Strips UTF-8 BOM and standardizes line breaks.
 */
export function sanitizeCsvContent(content: string): string {
  let cleaned = content;
  if (cleaned.charCodeAt(0) === 0xfeff) {
    cleaned = cleaned.slice(1);
  }
  return cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Normalizes an object's keys to lowercase trimmed strings for safe indexing.
 */
function normalizeRowKeys(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    normalized[key.trim().toLowerCase()] = typeof val === 'string' ? val.trim() : String(val || '');
  }
  return normalized;
}

export function parseCsvRows(content: string): Array<Record<string, string>> {
  const sanitized = sanitizeCsvContent(content);
  const result = Papa.parse<Record<string, string>>(sanitized, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false
  });
  return result.data.map(normalizeRowKeys);
}

/**
 * Parses Letterboxd List format (v7 or similar)
 * Format:
 * Letterboxd list export v7
 * Date,Name,Tags,URL,Description
 * ... (metadata row, description may be multi-line)
 *
 * Position,Name,Year,URL,Description
 * ... (items table)
 */
export function parseListCsv(content: string, slug: string): FilmList | null {
  const sanitized = sanitizeCsvContent(content);
  const lines = sanitized.split('\n');

  if (lines.length < 3) return null;

  // Find where metadata ends and items table begins
  // Usually marked by blank line followed by "Position,Name,Year,..."
  let itemsHeaderIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim().toLowerCase();
    if (trimmed.startsWith('position,name,year')) {
      itemsHeaderIndex = i;
      break;
    }
  }

  // If no items header found, try finding metadata table only
  let listName = slug;
  let listDate: string | undefined;
  let listTags: string[] = [];
  let listUrl: string | undefined;
  let listDesc: string | undefined;

  const metadataLines = itemsHeaderIndex > 0 ? lines.slice(0, itemsHeaderIndex) : lines.slice(0, 3);
  // Parse metadata section
  // Skip the first "Letterboxd list export..." line if present
  const metaStart = metadataLines[0].toLowerCase().includes('letterboxd list export') ? 1 : 0;
  const metaCsvText = metadataLines.slice(metaStart).join('\n');
  const metaParsed = Papa.parse<Record<string, string>>(metaCsvText, {
    header: true,
    skipEmptyLines: true
  });

  if (metaParsed.data.length > 0) {
    const metaRow = normalizeRowKeys(metaParsed.data[0]);
    listName = metaRow['name'] || slug;
    listDate = parseCalendarDate(metaRow['date'] || '') ? metaRow['date'] : undefined;
    listTags = metaRow['tags'] ? metaRow['tags'].split(',').map((t) => t.trim()).filter(Boolean) : [];
    listUrl = metaRow['url'] || undefined;
    listDesc = metaRow['description'] || undefined;
  }

  const items: ListItem[] = [];
  if (itemsHeaderIndex > 0) {
    const itemsCsvText = lines.slice(itemsHeaderIndex).join('\n');
    const itemsParsed = Papa.parse<Record<string, string>>(itemsCsvText, {
      header: true,
      skipEmptyLines: true
    });

    itemsParsed.data.forEach((row) => {
      const norm = normalizeRowKeys(row);
      const name = norm['name'];
      if (!name) return;
      const pos = parseInt(norm['position'] || '0', 10) || items.length + 1;
      const year = parseInt(norm['year'] || '', 10) || undefined;
      const url = norm['url'] || undefined;
      const desc = norm['description'] || undefined;

      items.push({
        position: pos,
        name,
        year,
        url,
        description: desc
      });
    });
  }

  return {
    slug,
    name: listName,
    date: listDate,
    tags: listTags,
    url: listUrl,
    description: listDesc,
    items
  };
}

/**
 * Main Letterboxd Export Processing Engine
 * Takes all extracted CSV contents as a map of fileName -> content
 */
export function processLetterboxdExport(files: Map<string, string>): IngestionState {
  const fileReports: ImportFileReport[] = [];
  const films: Record<string, Film> = {};
  const entries: Entry[] = [];
  const lists: FilmList[] = [];
  let profile: Profile | undefined = undefined;

  let ratingConflictsResolved = 0;
  const nameYearToCanonicalUri = new Map<string, string>();
  const collisions: Array<{ title: string; year?: number; uris: string[] }> = [];

  const getNameYearKey = (name: string, yearStr?: string): string => {
    const normName = name.trim().toLowerCase();
    const yr = yearStr ? parseInt(yearStr, 10) || '' : '';
    return `${normName}::${yr}`;
  };

  const registerCanonicalUri = (uri: string, name: string, yearStr?: string) => {
    const key = getNameYearKey(name, yearStr);
    const existing = nameYearToCanonicalUri.get(key);
    if (existing && existing !== uri) {
      const yr = yearStr ? parseInt(yearStr, 10) || undefined : undefined;
      collisions.push({ title: name, year: yr, uris: [existing, uri] });
    } else {
      nameYearToCanonicalUri.set(key, uri);
    }
  };

  // Helper to ensure film exists in index
  const getOrCreateFilm = (uri: string, name: string, yearStr?: string): Film => {
    const cleanUri = uri.trim();
    if (!films[cleanUri]) {
      const year = yearStr ? parseInt(yearStr, 10) || undefined : undefined;
      films[cleanUri] = {
        letterboxdUri: cleanUri,
        name: name.trim(),
        year,
        watched: false,
        liked: false,
        onWatchlist: false,
        match: { status: 'unmatched' }
      };
    }
    return films[cleanUri];
  };

  // 1. Process profile.csv
  const profileContent = files.get('profile.csv');
  if (profileContent) {
    const rows = parseCsvRows(profileContent);
    fileReports.push({
      fileName: 'profile.csv',
      rowsFound: rows.length,
      rowsAccepted: rows.length > 0 ? 1 : 0,
      rowsIgnored: Math.max(0, rows.length - 1)
    });

    if (rows.length > 0) {
      const r = rows[0];
      // PRIVACY: Only extract username, date joined, bio, given name, and favorite URIs.
      // Explicitly discard email address, family name, location, website, pronoun.
      const rawFavs = r['favorite films'] || r['favorite film'] || '';
      // Parse quoted comma-separated URIs
      const favUris = rawFavs
        .split(',')
        .map((u) => u.trim().replace(/^"|"$/g, ''))
        .filter((u) => u.startsWith('http'));

      profile = {
        username: r['username'] || 'Letterboxd User',
        dateJoined: parseCalendarDate(r['date joined'] || '') ? r['date joined'] : undefined,
        bio: r['bio'] || undefined,
        givenName: r['given name'] || undefined,
        favoriteFilmUris: favUris
      };
    }
  }

  // 2. Process watched.csv
  const watchedContent = files.get('watched.csv');
  if (watchedContent) {
    const rows = parseCsvRows(watchedContent);
    let accepted = 0;
    rows.forEach((r) => {
      const uri = r['letterboxd uri'];
      const name = r['name'];
      if (uri && name) {
        registerCanonicalUri(uri, name, r['year']);
        const film = getOrCreateFilm(uri, name, r['year']);
        film.watched = true;
        accepted++;
      }
    });
    fileReports.push({
      fileName: 'watched.csv',
      rowsFound: rows.length,
      rowsAccepted: accepted,
      rowsIgnored: rows.length - accepted
    });
  }

  // 3. Process ratings.csv
  const ratingsContent = files.get('ratings.csv');
  if (ratingsContent) {
    const rows = parseCsvRows(ratingsContent);
    let accepted = 0;
    rows.forEach((r) => {
      const uri = r['letterboxd uri'];
      const name = r['name'];
      const ratingVal = parseFloat(r['rating'] || '0');
      if (uri && name && !isNaN(ratingVal) && ratingVal > 0) {
        registerCanonicalUri(uri, name, r['year']);
        const film = getOrCreateFilm(uri, name, r['year']);
        film.rating = ratingVal;
        film.watched = true; // rating implies watched
        accepted++;
      }
    });
    fileReports.push({
      fileName: 'ratings.csv',
      rowsFound: rows.length,
      rowsAccepted: accepted,
      rowsIgnored: rows.length - accepted
    });
  }

  // 4. Process watchlist.csv
  const watchlistContent = files.get('watchlist.csv');
  if (watchlistContent) {
    const rows = parseCsvRows(watchlistContent);
    let accepted = 0;
    rows.forEach((r) => {
      const uri = r['letterboxd uri'];
      const name = r['name'];
      if (uri && name) {
        registerCanonicalUri(uri, name, r['year']);
        const film = getOrCreateFilm(uri, name, r['year']);
        film.onWatchlist = true;
        const wlDate = r['date'];
        if (wlDate && parseCalendarDate(wlDate)) {
          film.watchlistDate = wlDate;
        }
        accepted++;
      }
    });
    fileReports.push({
      fileName: 'watchlist.csv',
      rowsFound: rows.length,
      rowsAccepted: accepted,
      rowsIgnored: rows.length - accepted
    });
  }

  // 5. Process likes/films.csv
  const likesContent = files.get('likes/films.csv');
  if (likesContent) {
    const rows = parseCsvRows(likesContent);
    let accepted = 0;
    rows.forEach((r) => {
      const uri = r['letterboxd uri'];
      const name = r['name'];
      if (uri && name) {
        registerCanonicalUri(uri, name, r['year']);
        const film = getOrCreateFilm(uri, name, r['year']);
        film.liked = true;
        accepted++;
      }
    });
    fileReports.push({
      fileName: 'likes/films.csv',
      rowsFound: rows.length,
      rowsAccepted: accepted,
      rowsIgnored: rows.length - accepted
    });
  }

  // 6. Preload reviews map: key = `${canonicalFilmUri}::${watchedDate || loggedDate}`
  const reviewsMap = new Map<string, string>();
  const reviewsContent = files.get('reviews.csv');
  let reviewsCount = 0;
  if (reviewsContent) {
    const rows = parseCsvRows(reviewsContent);
    rows.forEach((r) => {
      const name = r['name'];
      const reviewText = r['review'];
      const dateKey = r['watched date'] || r['date'];
      if (name && reviewText) {
        const key = getNameYearKey(name, r['year']);
        const canonicalUri = nameYearToCanonicalUri.get(key) || r['letterboxd uri'];
        if (canonicalUri) {
          reviewsMap.set(`${canonicalUri}::${dateKey}`, reviewText);
          reviewsCount++;
        }
      }
    });
    fileReports.push({
      fileName: 'reviews.csv',
      rowsFound: rows.length,
      rowsAccepted: reviewsCount,
      rowsIgnored: rows.length - reviewsCount
    });
  }

  // 7. Process diary.csv
  const diaryContent = files.get('diary.csv');
  if (diaryContent) {
    const rows = parseCsvRows(diaryContent);
    let accepted = 0;
    rows.forEach((r, idx) => {
      const rawLogUri = r['letterboxd uri']?.trim();
      const name = r['name']?.trim();
      if (!name) return;

      const key = getNameYearKey(name, r['year']);
      let canonicalUri = nameYearToCanonicalUri.get(key);

      if (!canonicalUri) {
        // Diary-only film (not in watched, ratings, likes, or watchlist)
        canonicalUri = rawLogUri || `boxd:synth_${key}`;
        nameYearToCanonicalUri.set(key, canonicalUri);
      }

      const film = getOrCreateFilm(canonicalUri, name, r['year']);
      film.watched = true;

      // Watched Date vs Date
      const rawWatchedDate = r['watched date'];
      const rawLoggedDate = r['date'];

      let watchedDate: string | null = null;
      let isApproximate = false;

      if (rawWatchedDate && parseCalendarDate(rawWatchedDate)) {
        watchedDate = rawWatchedDate;
      } else if (rawLoggedDate && parseCalendarDate(rawLoggedDate)) {
        watchedDate = rawLoggedDate;
        isApproximate = true;
      }

      const loggedDate = rawLoggedDate && parseCalendarDate(rawLoggedDate) ? rawLoggedDate : (watchedDate || '1970-01-01');

      // Entry rating
      const rawRating = parseFloat(r['rating'] || '0');
      const entryRating = !isNaN(rawRating) && rawRating > 0 ? rawRating : undefined;

      // Precedence: if film had rating from ratings.csv and this entry has rating, check conflict
      if (film.rating !== undefined && entryRating !== undefined && film.rating !== entryRating) {
        ratingConflictsResolved++;
      }
      if (film.rating === undefined && entryRating !== undefined) {
        film.rating = entryRating;
      }

      const rewatchVal = r['rewatch']?.toLowerCase();
      const rewatch = rewatchVal === 'yes' || rewatchVal === 'true' || rewatchVal === '1';

      const tags = r['tags'] ? r['tags'].split(',').map((t) => t.trim()).filter(Boolean) : [];

      // Link review if exists
      const review = reviewsMap.get(`${canonicalUri}::${rawWatchedDate || rawLoggedDate}`) ||
                     reviewsMap.get(`${canonicalUri}::${rawLoggedDate}`);

      entries.push({
        entryId: rawLogUri || `entry_${idx}_${canonicalUri.replace(/[^a-zA-Z0-9]/g, '')}`,
        filmKey: canonicalUri,
        watchedDate,
        isApproximate,
        loggedDate,
        rating: entryRating,
        rewatch,
        tags,
        review
      });
      accepted++;
    });

    fileReports.push({
      fileName: 'diary.csv',
      rowsFound: rows.length,
      rowsAccepted: accepted,
      rowsIgnored: rows.length - accepted
    });
  }

  // 8. Process lists/*.csv
  files.forEach((content, path) => {
    if (path.startsWith('lists/') && path.endsWith('.csv')) {
      const slug = path.replace(/^lists\//, '').replace(/\.csv$/, '');
      const parsedList = parseListCsv(content, slug);
      if (parsedList) {
        lists.push(parsedList);
        fileReports.push({
          fileName: path,
          rowsFound: parsedList.items.length,
          rowsAccepted: parsedList.items.length,
          rowsIgnored: 0
        });
      }
    }
  });

  // Track ignored files
  files.forEach((_, path) => {
    if (
      path.startsWith('deleted/') ||
      path.startsWith('orphaned/') ||
      path === 'comments.csv' ||
      path === 'likes/lists.csv' ||
      path === 'likes/reviews.csv'
    ) {
      fileReports.push({
        fileName: path,
        rowsFound: 0,
        rowsAccepted: 0,
        rowsIgnored: 0,
        reason: 'Ignored per specification (third-party or deleted content)'
      });
    }
  });

  // Analytics summary counts
  const allFilms = Object.values(films);
  const filmsWithDiary = new Set(entries.map((e) => e.filmKey));
  let filmsDateUnknown = 0;
  allFilms.forEach((f) => {
    if (f.watched && !filmsWithDiary.has(f.letterboxdUri)) {
      filmsDateUnknown++;
    }
  });

  const report: ImportReport = {
    importedAt: Date.now(),
    files: fileReports,
    totalUniqueFilms: allFilms.length,
    totalEntries: entries.length,
    totalReviews: reviewsCount,
    totalLists: lists.length,
    filmsWithRating: allFilms.filter((f) => f.rating !== undefined).length,
    filmsWatched: allFilms.filter((f) => f.watched).length,
    filmsOnWatchlist: allFilms.filter((f) => f.onWatchlist).length,
    filmsLiked: allFilms.filter((f) => f.liked).length,
    filmsDateUnknown,
    ratingConflictsResolved,
    collisions: collisions.length > 0 ? collisions : undefined
  };

  return {
    films,
    entries,
    lists,
    profile,
    report
  };
}
