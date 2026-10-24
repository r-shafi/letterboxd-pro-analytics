/**
 * Letterboxd CSV Parser & Data Normalizer
 * Pure, robust parsing by column header names with multi-line quote support,
 * BOM stripping, CRLF normalization, privacy filtering, date verification,
 * and 5-column reconciliation (Found = Added + Applied + Skipped).
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
 * Parses Letterboxd List format (v7 or similar) using Papaparse table extraction.
 * Immune to multi-line descriptions and line breaks.
 */
export function parseListCsv(content: string, slug: string): FilmList | null {
  const sanitized = sanitizeCsvContent(content);
  const result = Papa.parse<string[]>(sanitized, {
    header: false,
    skipEmptyLines: 'greedy'
  });

  const rawRows = result.data;
  if (rawRows.length < 3) return null;

  // Locate metadata header row and items header row
  let metaHeaderIdx = -1;
  let itemsHeaderIdx = -1;

  for (let i = 0; i < rawRows.length; i++) {
    const row0 = (rawRows[i][0] || '').trim().toLowerCase();
    const row1 = (rawRows[i][1] || '').trim().toLowerCase();

    if (row0 === 'date' && row1 === 'name') {
      metaHeaderIdx = i;
    } else if (row0 === 'position' && row1 === 'name') {
      itemsHeaderIdx = i;
    }
  }

  let listName = slug;
  let listDate: string | undefined;
  let listTags: string[] = [];
  let listUrl: string | undefined;
  let listDesc: string | undefined;

  // Parse metadata row if found
  if (metaHeaderIdx !== -1 && metaHeaderIdx + 1 < rawRows.length) {
    const metaHeaders = rawRows[metaHeaderIdx].map((h) => (h || '').trim().toLowerCase());
    const metaValues = rawRows[metaHeaderIdx + 1];

    const getMetaVal = (col: string): string => {
      const idx = metaHeaders.indexOf(col);
      return idx !== -1 && metaValues[idx] ? metaValues[idx].trim() : '';
    };

    listName = getMetaVal('name') || slug;
    const rawDate = getMetaVal('date');
    listDate = parseCalendarDate(rawDate) ? rawDate : undefined;
    const rawTags = getMetaVal('tags');
    listTags = rawTags ? rawTags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    listUrl = getMetaVal('url') || undefined;
    listDesc = getMetaVal('description') || undefined;
  }

  // Parse items table
  const items: ListItem[] = [];
  if (itemsHeaderIdx !== -1 && itemsHeaderIdx + 1 < rawRows.length) {
    const itemHeaders = rawRows[itemsHeaderIdx].map((h) => (h || '').trim().toLowerCase());
    const nameIdx = itemHeaders.indexOf('name');
    const posIdx = itemHeaders.indexOf('position');
    const yearIdx = itemHeaders.indexOf('year');
    const urlIdx = itemHeaders.indexOf('url');
    const descIdx = itemHeaders.indexOf('description');

    for (let i = itemsHeaderIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;
      const name = nameIdx !== -1 ? (row[nameIdx] || '').trim() : '';
      if (!name) continue;

      const rawPos = posIdx !== -1 ? (row[posIdx] || '').trim() : '';
      const pos = parseInt(rawPos, 10) || items.length + 1;

      const rawYear = yearIdx !== -1 ? (row[yearIdx] || '').trim() : '';
      const year = parseInt(rawYear, 10) || undefined;

      const url = urlIdx !== -1 ? (row[urlIdx] || '').trim() || undefined : undefined;
      const desc = descIdx !== -1 ? (row[descIdx] || '').trim() || undefined : undefined;

      items.push({
        position: pos,
        name,
        year,
        url,
        description: desc
      });
    }
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
  const getOrCreateFilm = (
    uri: string,
    name: string,
    yearStr?: string
  ): { film: Film; isNew: boolean } => {
    const cleanUri = uri.trim();
    let isNew = false;
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
      isNew = true;
    }
    return { film: films[cleanUri], isNew };
  };

  // Helper to add reconciled file report (enforces Found = Added + Applied + Skipped)
  const addFileReport = (rep: ImportFileReport) => {
    const verifiedSkipped = rep.recordsFound - (rep.recordsAdded + rep.recordsApplied);
    const finalReport: ImportFileReport = {
      ...rep,
      recordsSkipped: verifiedSkipped >= 0 ? verifiedSkipped : rep.recordsSkipped,
      rowsFound: rep.recordsFound,
      rowsAccepted: rep.recordsAdded + rep.recordsApplied,
      rowsIgnored: verifiedSkipped >= 0 ? verifiedSkipped : rep.recordsSkipped
    };
    fileReports.push(finalReport);
  };

  // 1. Process profile.csv
  const profileContent = files.get('profile.csv');
  if (profileContent) {
    const rows = parseCsvRows(profileContent);
    const added = rows.length > 0 ? 1 : 0;
    const skipped = Math.max(0, rows.length - 1);

    if (rows.length > 0) {
      const r = rows[0];
      // PRIVACY: Only extract username, date joined, bio, given name, and favorite URIs.
      // Explicitly discard email address, family name, location, website, pronoun.
      const rawFavs = r['favorite films'] || r['favorite film'] || '';
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

    addFileReport({
      fileName: 'profile.csv',
      recordsFound: rows.length,
      recordsAdded: added,
      recordsApplied: 0,
      recordsSkipped: skipped,
      status: 'Processed'
    });
  }

  // 2. Process watched.csv
  const watchedContent = files.get('watched.csv');
  if (watchedContent) {
    const rows = parseCsvRows(watchedContent);
    let added = 0;
    let applied = 0;
    let skipped = 0;

    rows.forEach((r) => {
      const uri = r['letterboxd uri'];
      const name = r['name'];
      if (uri && name) {
        registerCanonicalUri(uri, name, r['year']);
        const { film, isNew } = getOrCreateFilm(uri, name, r['year']);
        film.watched = true;
        if (isNew) added++;
        else applied++;
      } else {
        skipped++;
      }
    });

    addFileReport({
      fileName: 'watched.csv',
      recordsFound: rows.length,
      recordsAdded: added,
      recordsApplied: applied,
      recordsSkipped: skipped,
      status: 'Processed'
    });
  }

  // 3. Process ratings.csv
  const ratingsContent = files.get('ratings.csv');
  if (ratingsContent) {
    const rows = parseCsvRows(ratingsContent);
    let added = 0;
    let applied = 0;
    let skipped = 0;

    rows.forEach((r) => {
      const uri = r['letterboxd uri'];
      const name = r['name'];
      const ratingVal = parseFloat(r['rating'] || '0');
      if (uri && name && !isNaN(ratingVal) && ratingVal > 0) {
        registerCanonicalUri(uri, name, r['year']);
        const { film, isNew } = getOrCreateFilm(uri, name, r['year']);
        film.rating = ratingVal;
        film.watched = true; // rating implies watched
        if (isNew) added++;
        else applied++;
      } else {
        skipped++;
      }
    });

    addFileReport({
      fileName: 'ratings.csv',
      recordsFound: rows.length,
      recordsAdded: added,
      recordsApplied: applied,
      recordsSkipped: skipped,
      status: added > 0 ? 'Processed' : 'Merged'
    });
  }

  // 4. Process watchlist.csv
  const watchlistContent = files.get('watchlist.csv');
  if (watchlistContent) {
    const rows = parseCsvRows(watchlistContent);
    let added = 0;
    let applied = 0;
    let skipped = 0;

    rows.forEach((r) => {
      const uri = r['letterboxd uri'];
      const name = r['name'];
      if (uri && name) {
        registerCanonicalUri(uri, name, r['year']);
        const { film, isNew } = getOrCreateFilm(uri, name, r['year']);
        film.onWatchlist = true;
        const wlDate = r['date'];
        if (wlDate && parseCalendarDate(wlDate)) {
          film.watchlistDate = wlDate;
        }
        if (isNew) added++;
        else applied++;
      } else {
        skipped++;
      }
    });

    addFileReport({
      fileName: 'watchlist.csv',
      recordsFound: rows.length,
      recordsAdded: added,
      recordsApplied: applied,
      recordsSkipped: skipped,
      status: 'Processed'
    });
  }

  // 5. Process likes/films.csv
  const likesContent = files.get('likes/films.csv');
  if (likesContent) {
    const rows = parseCsvRows(likesContent);
    let added = 0;
    let applied = 0;
    let skipped = 0;

    rows.forEach((r) => {
      const uri = r['letterboxd uri'];
      const name = r['name'];
      if (uri && name) {
        registerCanonicalUri(uri, name, r['year']);
        const { film, isNew } = getOrCreateFilm(uri, name, r['year']);
        film.liked = true;
        if (isNew) added++;
        else applied++;
      } else {
        skipped++;
      }
    });

    addFileReport({
      fileName: 'likes/films.csv',
      recordsFound: rows.length,
      recordsAdded: added,
      recordsApplied: applied,
      recordsSkipped: skipped,
      status: added > 0 ? 'Processed' : 'Merged'
    });
  }

  // 6. Preload reviews map: key = `${canonicalFilmUri}::${watchedDate || loggedDate}`
  const reviewsMap = new Map<string, string>();
  const reviewsContent = files.get('reviews.csv');
  let reviewsCount = 0;
  if (reviewsContent) {
    const rows = parseCsvRows(reviewsContent);
    let skipped = 0;

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
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    });

    addFileReport({
      fileName: 'reviews.csv',
      recordsFound: rows.length,
      recordsAdded: reviewsCount,
      recordsApplied: 0,
      recordsSkipped: skipped,
      status: 'Processed'
    });
  }

  // 7. Process diary.csv
  const diaryContent = files.get('diary.csv');
  if (diaryContent) {
    const rows = parseCsvRows(diaryContent);
    let accepted = 0;
    let skipped = 0;

    rows.forEach((r, idx) => {
      const rawLogUri = r['letterboxd uri']?.trim();
      const name = r['name']?.trim();
      if (!name) {
        skipped++;
        return;
      }

      const key = getNameYearKey(name, r['year']);
      let canonicalUri = nameYearToCanonicalUri.get(key);

      if (!canonicalUri) {
        // Diary-only film (not in watched, ratings, likes, or watchlist)
        canonicalUri = rawLogUri || `boxd:synth_${key}`;
        nameYearToCanonicalUri.set(key, canonicalUri);
      }

      const { film } = getOrCreateFilm(canonicalUri, name, r['year']);
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

      const loggedDate =
        rawLoggedDate && parseCalendarDate(rawLoggedDate)
          ? rawLoggedDate
          : watchedDate || '1970-01-01';

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
      const review =
        reviewsMap.get(`${canonicalUri}::${rawWatchedDate || rawLoggedDate}`) ||
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

    addFileReport({
      fileName: 'diary.csv',
      recordsFound: rows.length,
      recordsAdded: accepted,
      recordsApplied: 0,
      recordsSkipped: skipped,
      status: 'Processed'
    });
  }

  // 8. Process lists/*.csv (1 row per list file with item count)
  files.forEach((content, path) => {
    if (path.startsWith('lists/') && path.endsWith('.csv')) {
      const slug = path.replace(/^lists\//, '').replace(/\.csv$/, '');
      const parsedList = parseListCsv(content, slug);
      if (parsedList) {
        lists.push(parsedList);
        addFileReport({
          fileName: path,
          recordsFound: parsedList.items.length,
          recordsAdded: parsedList.items.length,
          recordsApplied: 0,
          recordsSkipped: 0,
          status: 'Processed'
        });
      }
    }
  });

  // 9. Track ignored files ONLY if present in the archive
  const IGNORED_DEFINITIONS: Record<string, string> = {
    'comments.csv': 'Third-party user comments export',
    'likes/lists.csv': 'List likes (not part of personal film library)',
    'likes/reviews.csv': 'Review likes (not part of personal film library)'
  };

  files.forEach((content, path) => {
    let ignoreReason: string | undefined;

    if (IGNORED_DEFINITIONS[path]) {
      ignoreReason = IGNORED_DEFINITIONS[path];
    } else if (path.startsWith('deleted/')) {
      ignoreReason = 'Deleted records export';
    } else if (path.startsWith('orphaned/')) {
      ignoreReason = 'Orphaned entries export';
    }

    if (ignoreReason) {
      const rows = parseCsvRows(content);
      addFileReport({
        fileName: path,
        recordsFound: rows.length,
        recordsAdded: 0,
        recordsApplied: 0,
        recordsSkipped: rows.length,
        status: 'Ignored',
        reason: ignoreReason
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
