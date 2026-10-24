import { describe, it, expect } from 'vitest';
import { processLetterboxdExport, parseListCsv } from '../src/services/parser/csvParser.ts';

describe('Phase 4: Import & Data Quality Report - Files Processed & Reconciliation Invariants', () => {
  it('1. Table reconciliation invariant: recordsFound === recordsAdded + recordsApplied + recordsSkipped across all files', () => {
    const filesMap = new Map<string, string>();

    // Profile with 1 record
    filesMap.set('profile.csv', 'Date,Username,Given Name,Family Name,Email,Favorite Films\n2022-01-01,cinephile,John,Doe,john@example.com,"https://boxd.it/f1"\n');

    // Watched with 3 records
    filesMap.set(
      'watched.csv',
      '\uFEFFDate,Name,Year,Letterboxd URI\r\n' +
        '2022-01-01,Inception,2010,https://boxd.it/f1\r\n' +
        '2022-01-02,Interstellar,2014,https://boxd.it/f2\r\n' +
        '2022-01-03,Memento,2000,https://boxd.it/f3\r\n'
    );

    // Ratings with 3 records: 2 applied to existing watched films, 1 new film
    filesMap.set(
      'ratings.csv',
      'Date,Name,Year,Letterboxd URI,Rating\n' +
        '2022-01-01,Inception,2010,https://boxd.it/f1,4.5\n' +
        '2022-01-02,Interstellar,2014,https://boxd.it/f2,5.0\n' +
        '2022-01-04,Dunkirk,2017,https://boxd.it/f4,4.0\n'
    );

    // Watchlist with 2 records: 1 applied to existing, 1 new
    filesMap.set(
      'watchlist.csv',
      'Date,Name,Year,Letterboxd URI\n' +
        '2022-02-01,Memento,2000,https://boxd.it/f3\n' +
        '2022-02-02,Oppenheimer,2023,https://boxd.it/f5\n'
    );

    // Likes with 1 record applied to existing
    filesMap.set(
      'likes/films.csv',
      'Date,Name,Year,Letterboxd URI\n' +
        '2022-01-01,Inception,2010,https://boxd.it/f1\n'
    );

    // Reviews with multi-line quoted review text
    filesMap.set(
      'reviews.csv',
      'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n' +
        '2022-01-01,Inception,2010,https://boxd.it/f1,4.5,No,"A mind-bending masterpiece.\nSecond line of review.\nThird line of review.","sci-fi",2022-01-01\n'
    );

    // Diary with 2 entries
    filesMap.set(
      'diary.csv',
      'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
        '2022-01-01,Inception,2010,https://boxd.it/f1,4.5,No,"cinema",2022-01-01\n' +
        '2022-03-01,Tenet,2020,https://boxd.it/f6,3.5,No,"imax",2022-03-01\n'
    );

    // List with multi-line description and 2 items
    filesMap.set(
      'lists/nolan-favorites.csv',
      'Letterboxd list export v7\n' +
        'Date,Name,Tags,URL,Description\n' +
        '2023-01-01,Nolan Ranking,"nolan, favorites",https://boxd.it/list_1,"My personal ranking of Nolan films.\nUpdated after Tenet."\n' +
        '\n' +
        'Position,Name,Year,URL,Description\n' +
        '1,Inception,2010,https://boxd.it/f1,Number one\n' +
        '2,Interstellar,2014,https://boxd.it/f2,Number two\n'
    );

    // Present ignored files
    filesMap.set('comments.csv', 'Date,Comment,URL\n2022-01-01,"Great review",https://boxd.it/c1\n2022-01-02,"Agreed",https://boxd.it/c2\n');
    filesMap.set('deleted/diary.csv', 'Date,Name,Year,Letterboxd URI\n');
    filesMap.set('orphaned/reviews.csv', 'Date,Name,Year,Review\n');

    const state = processLetterboxdExport(filesMap);

    // Enforce invariant on EVERY file in report: Found === Added + Applied + Skipped
    state.report.files.forEach((file) => {
      const sum = file.recordsAdded + file.recordsApplied + file.recordsSkipped;
      expect(file.recordsFound).toBe(sum);
    });

    // Profile: 1 found, 1 added, 0 applied, 0 skipped
    const profileRep = state.report.files.find((f) => f.fileName === 'profile.csv');
    expect(profileRep).toBeDefined();
    expect(profileRep?.recordsFound).toBe(1);
    expect(profileRep?.recordsAdded).toBe(1);
    expect(profileRep?.recordsApplied).toBe(0);
    expect(profileRep?.recordsSkipped).toBe(0);
    expect(profileRep?.status).toBe('Processed');

    // Watched: 3 found, 3 added, 0 applied, 0 skipped
    const watchedRep = state.report.files.find((f) => f.fileName === 'watched.csv');
    expect(watchedRep?.recordsFound).toBe(3);
    expect(watchedRep?.recordsAdded).toBe(3);
    expect(watchedRep?.recordsApplied).toBe(0);
    expect(watchedRep?.recordsSkipped).toBe(0);

    // Ratings: 3 found, 1 added (Dunkirk), 2 applied (Inception, Interstellar), 0 skipped
    const ratingsRep = state.report.files.find((f) => f.fileName === 'ratings.csv');
    expect(ratingsRep?.recordsFound).toBe(3);
    expect(ratingsRep?.recordsAdded).toBe(1);
    expect(ratingsRep?.recordsApplied).toBe(2);
    expect(ratingsRep?.recordsSkipped).toBe(0);

    // Likes: 1 found, 0 added, 1 applied, 0 skipped, status 'Merged'
    const likesRep = state.report.files.find((f) => f.fileName === 'likes/films.csv');
    expect(likesRep?.recordsFound).toBe(1);
    expect(likesRep?.recordsAdded).toBe(0);
    expect(likesRep?.recordsApplied).toBe(1);
    expect(likesRep?.recordsSkipped).toBe(0);
    expect(likesRep?.status).toBe('Merged');

    // Reviews: multi-line review counted as 1 record, not 3 lines
    const reviewsRep = state.report.files.find((f) => f.fileName === 'reviews.csv');
    expect(reviewsRep?.recordsFound).toBe(1);
    expect(reviewsRep?.recordsAdded).toBe(1);

    // List: exactly 2 items found, multi-line description does not inflate count
    const listRep = state.report.files.find((f) => f.fileName === 'lists/nolan-favorites.csv');
    expect(listRep?.recordsFound).toBe(2);
    expect(listRep?.recordsAdded).toBe(2);

    // Ignored files: marked with status 'Ignored' and specific reason
    const commentsRep = state.report.files.find((f) => f.fileName === 'comments.csv');
    expect(commentsRep?.recordsFound).toBe(2);
    expect(commentsRep?.status).toBe('Ignored');
    expect(commentsRep?.recordsSkipped).toBe(2);
    expect(commentsRep?.reason).toBeDefined();

    const deletedRep = state.report.files.find((f) => f.fileName === 'deleted/diary.csv');
    expect(deletedRep?.recordsFound).toBe(0);
    expect(deletedRep?.status).toBe('Ignored');

    // Absent files (e.g. likes/lists.csv, orphaned/comments.csv) MUST NOT appear in report
    expect(state.report.files.some((f) => f.fileName === 'likes/lists.csv')).toBe(false);
    expect(state.report.files.some((f) => f.fileName === 'orphaned/comments.csv')).toBe(false);
  });

  it('2. List CSV with multi-line description parses metadata and items correctly', () => {
    const listCsv = `Letterboxd list export v7
Date,Name,Tags,URL,Description
2023-05-10,Summer Blockbusters,"summer, 90s",https://boxd.it/summer,"Line 1 of description
Line 2 of description
Line 3 with ""quotes"" and symbols"

Position,Name,Year,URL,Description
1,Jurassic Park,1993,https://boxd.it/182,Dinosaurs everywhere
2,Independence Day,1996,https://boxd.it/196,Aliens arrive
`;

    const parsed = parseListCsv(listCsv, 'summer-blockbusters');
    expect(parsed).not.toBeNull();
    expect(parsed?.name).toBe('Summer Blockbusters');
    expect(parsed?.items.length).toBe(2);
    expect(parsed?.items[0].name).toBe('Jurassic Park');
    expect(parsed?.items[0].year).toBe(1993);
    expect(parsed?.items[1].name).toBe('Independence Day');
  });
});
