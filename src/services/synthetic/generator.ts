/**
 * Synthetic Letterboxd Export Generator
 * Generates realistic Letterboxd export zips with edge cases:
 * - Unicode & accented titles
 * - Commas, quotes and newlines in reviews and list descriptions
 * - Duplicate titles across different years
 * - Rewatches
 * - Date-unknown films (only in watched.csv or ratings.csv)
 * - Privacy sensitive profile fields (email, family name, etc.)
 * - Lists in v7 format
 * - BOM & CRLF variants
 */

import { zipSync, strToU8 } from 'fflate';

export interface SyntheticExportOptions {
  filmCount: number;
  includeBOM?: boolean;
  useCRLF?: boolean;
}

// Guaranteed fflate-compatible Uint8Array constructor (resilient across jsdom and Node realms)
const FflateU8 = strToU8('', true).constructor as typeof Uint8Array;

function encodeToFflateU8(str: string): Uint8Array {
  const utf8Bytes = new TextEncoder().encode(str);
  const dest = new FflateU8(utf8Bytes.length);
  dest.set(utf8Bytes);
  return dest;
}

export function generateSyntheticExportFiles(options: SyntheticExportOptions): Record<string, Uint8Array> {
  const { filmCount, includeBOM = true, useCRLF = true } = options;
  const eol = useCRLF ? '\r\n' : '\n';
  const bom = includeBOM ? '\uFEFF' : '';

  const files: Record<string, Uint8Array> = {};

  const sampleTitles = [
    { name: 'Star Wars', year: 1977 },
    { name: 'The Empire Strikes Back', year: 1980 },
    { name: 'Amélie', year: 2001 },
    { name: 'Pan\'s Labyrinth', year: 2006 },
    { name: '千と千尋の神隠し', year: 2001 },
    { name: 'Roma', year: 2018 },
    { name: 'Parasite', year: 2019 },
    { name: 'Little Women', year: 1994 },
    { name: 'Little Women', year: 2019 },
    { name: 'Dune', year: 1984 },
    { name: 'Dune', year: 2021 },
    { name: 'Inception', year: 2010 },
    { name: 'Interstellar', year: 2014 },
    { name: 'Blade Runner 2049', year: 2017 },
    { name: 'Mad Max: Fury Road', year: 2015 },
    { name: 'The Grand Budapest Hotel', year: 2014 },
    { name: 'Spider-Man: Into the Spider-Verse', year: 2018 },
    { name: 'Everything Everywhere All at Once', year: 2022 },
    { name: 'Oppenheimer', year: 2023 },
    { name: 'Unmatchable Movie Nonexistent 9999', year: 2099 }
  ];

  interface FilmRecord {
    uri: string;
    name: string;
    year: number;
    rating?: number;
    watched: boolean;
    onWatchlist: boolean;
    liked: boolean;
    diaryEntries: Array<{
      date: string;
      watchedDate: string;
      rating?: number;
      rewatch: boolean;
      tags: string;
      review?: string;
      logUri: string;
    }>;
  }

  const films: FilmRecord[] = [];
  const baseUris: string[] = [];

  for (let i = 0; i < filmCount; i++) {
    const template = sampleTitles[i % sampleTitles.length];
    const suffix = i >= sampleTitles.length ? ` (Edition ${Math.floor(i / sampleTitles.length)})` : '';
    const name = `${template.name}${suffix}`;
    const year = template.year;
    const uri = `https://boxd.it/synth_${i}`;
    baseUris.push(uri);

    const isDateUnknown = i % 5 === 0;
    const isWatchlist = i % 7 === 0;
    const isLiked = i % 3 === 0;
    const hasRating = i % 2 === 0;
    const rating = hasRating ? ((i % 10) + 1) * 0.5 : undefined;

    const diaryEntries: FilmRecord['diaryEntries'] = [];

    if (!isDateUnknown) {
      const entryCount = i % 8 === 0 ? 3 : i % 4 === 0 ? 2 : 1;
      for (let e = 0; e < entryCount; e++) {
        const yearOffset = 2020 + (i % 6);
        const monthOffset = String((i % 12) + 1).padStart(2, '0');
        const dayOffset = String((((i + e) * 3) % 27) + 1).padStart(2, '0');
        const watchedDate = `${yearOffset}-${monthOffset}-${dayOffset}`;
        const loggedDate = `${yearOffset}-${monthOffset}-${String(Math.min(28, parseInt(dayOffset, 10) + 1)).padStart(2, '0')}`;

        const entryRating = rating !== undefined ? Math.min(5, Math.max(0.5, rating + (e * 0.5))) : undefined;

        let review: string | undefined;
        if (e === 0 && i % 3 === 0) {
          review = `A masterpiece, truly.\n"Cinema at its finest", with extraordinary direction.\nHighly recommended.`;
        }

        const logUri = `https://boxd.it/log_${i}_${e}`;
        diaryEntries.push({
          date: loggedDate,
          watchedDate,
          rating: entryRating,
          rewatch: e > 0,
          tags: i % 2 === 0 ? 'cinema, favorites' : 'streamed',
          review,
          logUri
        });
      }
    }

    films.push({
      uri,
      name,
      year,
      rating,
      watched: true,
      onWatchlist: isWatchlist,
      liked: isLiked,
      diaryEntries
    });
  }

  // 1. profile.csv
  const favUris = baseUris.slice(0, 4).join(', ');
  const profileLines = [
    'Date Joined,Username,Given Name,Family Name,Email Address,Location,Website,Bio,Pronoun,Favorite Films',
    `2020-01-01,synthetic_cinephile,Alex,SecretFamily,sensitive_private_email@example.com,San Francisco,https://example.com,"Lover of film and deep analysis.",They / Them,"${favUris}"`
  ];
  files['profile.csv'] = encodeToFflateU8(bom + profileLines.join(eol) + eol);

  // 2. watched.csv
  const watchedLines = ['Date,Name,Year,Letterboxd URI'];
  films.forEach((f) => {
    watchedLines.push(`2020-01-01,"${f.name.replace(/"/g, '""')}",${f.year},${f.uri}`);
  });
  files['watched.csv'] = encodeToFflateU8(bom + watchedLines.join(eol) + eol);

  // 3. ratings.csv
  const ratingsLines = ['Date,Name,Year,Letterboxd URI,Rating'];
  films.forEach((f) => {
    if (f.rating !== undefined) {
      ratingsLines.push(`2020-01-02,"${f.name.replace(/"/g, '""')}",${f.year},${f.uri},${f.rating}`);
    }
  });
  files['ratings.csv'] = encodeToFflateU8(bom + ratingsLines.join(eol) + eol);

  // 4. watchlist.csv
  const watchlistLines = ['Date,Name,Year,Letterboxd URI'];
  films.forEach((f) => {
    if (f.onWatchlist) {
      watchlistLines.push(`2021-06-15,"${f.name.replace(/"/g, '""')}",${f.year},${f.uri}`);
    }
  });
  files['watchlist.csv'] = encodeToFflateU8(bom + watchlistLines.join(eol) + eol);

  // 5. likes/films.csv
  const likesLines = ['Date,Name,Year,Letterboxd URI'];
  films.forEach((f) => {
    if (f.liked) {
      likesLines.push(`2021-03-20,"${f.name.replace(/"/g, '""')}",${f.year},${f.uri}`);
    }
  });
  files['likes/films.csv'] = encodeToFflateU8(bom + likesLines.join(eol) + eol);

  // 6. reviews.csv
  const reviewsLines = ['Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date'];
  films.forEach((f) => {
    f.diaryEntries.forEach((entry) => {
      if (entry.review) {
        const escapedRev = `"${entry.review.replace(/"/g, '""')}"`;
        reviewsLines.push(
          `${entry.date},"${f.name.replace(/"/g, '""')}",${f.year},${entry.logUri},${entry.rating || ''},${entry.rewatch ? 'Yes' : ''},${escapedRev},"${entry.tags}",${entry.watchedDate}`
        );
      }
    });
  });
  files['reviews.csv'] = encodeToFflateU8(bom + reviewsLines.join(eol) + eol);

  // 7. diary.csv
  const diaryLines = ['Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date'];
  films.forEach((f) => {
    f.diaryEntries.forEach((entry) => {
      diaryLines.push(
        `${entry.date},"${f.name.replace(/"/g, '""')}",${f.year},${entry.logUri},${entry.rating || ''},${entry.rewatch ? 'Yes' : ''},"${entry.tags}",${entry.watchedDate}`
      );
    });
  });
  files['diary.csv'] = encodeToFflateU8(bom + diaryLines.join(eol) + eol);

  // 8. lists/best-of-cinema.csv in v7 format
  const listLines = [
    'Letterboxd list export v7',
    'Date,Name,Tags,URL,Description',
    `2023-01-01,Best of Cinema,"masterpieces, ranking",https://boxd.it/list_1,"A curated selection of essential films.\nUpdated frequently."`,
    '',
    'Position,Name,Year,URL,Description'
  ];
  films.slice(0, Math.min(20, films.length)).forEach((f, idx) => {
    listLines.push(`${idx + 1},"${f.name.replace(/"/g, '""')}",${f.year},${f.uri},"Rank ${idx + 1}"`);
  });
  files['lists/best-of-cinema.csv'] = encodeToFflateU8(bom + listLines.join(eol) + eol);

  // 9. Ignored folders & files
  files['comments.csv'] = encodeToFflateU8(bom + 'Date,Content,Comment' + eol);
  files['likes/lists.csv'] = encodeToFflateU8(bom + 'Date,Content' + eol);
  files['likes/reviews.csv'] = encodeToFflateU8(bom + 'Date,Content' + eol);
  files['deleted/diary.csv'] = encodeToFflateU8(bom + 'Date,Name,Year,Letterboxd URI' + eol);
  files['deleted/reviews.csv'] = encodeToFflateU8(bom + 'Date,Name,Year,Letterboxd URI' + eol);
  files['deleted/comments.csv'] = encodeToFflateU8(bom + 'Date,Content' + eol);
  files['orphaned/diary.csv'] = encodeToFflateU8(bom + 'Date,Name,Year,Letterboxd URI' + eol);
  files['orphaned/reviews.csv'] = encodeToFflateU8(bom + 'Date,Name,Year,Letterboxd URI' + eol);
  files['orphaned/comments.csv'] = encodeToFflateU8(bom + 'Date,Content' + eol);

  return files;
}

export function generateSyntheticZip(options: SyntheticExportOptions): Uint8Array {
  const files = generateSyntheticExportFiles(options);
  return zipSync(files);
}
