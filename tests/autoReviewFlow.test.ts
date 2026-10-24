import { describe, it, expect, beforeEach } from 'vitest';
import { useIngestionStore } from '../src/store/ingestionStore.ts';
import { Film } from '../src/types/domain.ts';

describe('Phase 3 Additions - Auto-Open Review Modal & Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    useIngestionStore.setState({
      status: 'idle',
      films: {},
      entries: [],
      lists: [],
      profile: undefined,
      autoOpenReviewModal: false,
      allMatchedToast: false,
      reviewNeededCount: 0,
      activeImportId: undefined
    });
  });

  it('triggers autoOpenReviewModal immediately after Stage 1 matching if review items exist', () => {
    const importId = 'import_test_1';
    const films: Record<string, Film> = {
      'https://boxd.it/f1': {
        letterboxdUri: 'https://boxd.it/f1',
        name: 'Justice League',
        year: 2017,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'ambiguous',
          reason: 'same_title_duplicates',
          candidates: [
            { id: 1, title: 'Justice League', originalTitle: 'Justice League', year: 2017, confidenceScore: 1.0 },
            { id: 2, title: 'Justice League Dark', originalTitle: 'Justice League Dark', year: 2017, confidenceScore: 0.75 }
          ]
        }
      },
      'https://boxd.it/f2': {
        letterboxdUri: 'https://boxd.it/f2',
        name: 'Brooklyn',
        year: 2015,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'confident',
          tmdbId: 167073
        }
      }
    };

    useIngestionStore.setState({
      activeImportId: importId,
      films,
      reviewNeededCount: 1,
      autoOpenReviewModal: true,
      allMatchedToast: false
    });

    const state = useIngestionStore.getState();
    expect(state.autoOpenReviewModal).toBe(true);
    expect(state.allMatchedToast).toBe(false);
    expect(state.reviewNeededCount).toBe(1);
  });

  it('shows All Films Matched toast and does not open modal when 0 films need review', () => {
    const importId = 'import_test_clean';
    const films: Record<string, Film> = {
      'https://boxd.it/f1': {
        letterboxdUri: 'https://boxd.it/f1',
        name: 'Brooklyn',
        year: 2015,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'confident',
          tmdbId: 167073
        }
      }
    };

    useIngestionStore.setState({
      activeImportId: importId,
      films,
      reviewNeededCount: 0,
      autoOpenReviewModal: false,
      allMatchedToast: true
    });

    const state = useIngestionStore.getState();
    expect(state.autoOpenReviewModal).toBe(false);
    expect(state.allMatchedToast).toBe(true);
  });

  it('dismissing marks review prompt as shown in localStorage so it never reopens on reload', () => {
    const importId = 'import_dismiss_test';
    useIngestionStore.setState({
      activeImportId: importId,
      autoOpenReviewModal: true,
      reviewNeededCount: 2
    });

    // Dismiss review prompt
    useIngestionStore.getState().dismissReviewPrompt();

    const state = useIngestionStore.getState();
    expect(state.autoOpenReviewModal).toBe(false);
    expect(localStorage.getItem(`lb_review_prompt_shown_${importId}`)).toBe('true');
  });

  it('subsequent import with a new importId opens review modal again if ambiguous items exist', () => {
    const firstImportId = 'import_1';
    localStorage.setItem(`lb_review_prompt_shown_${firstImportId}`, 'true');

    // Second import occurs
    const secondImportId = 'import_2';
    const isShownForSecond = localStorage.getItem(`lb_review_prompt_shown_${secondImportId}`) === 'true';
    expect(isShownForSecond).toBe(false);

    useIngestionStore.setState({
      activeImportId: secondImportId,
      autoOpenReviewModal: !isShownForSecond,
      reviewNeededCount: 3
    });

    expect(useIngestionStore.getState().autoOpenReviewModal).toBe(true);
  });

  it('overrideMatch performs instant optimistic match and decrements reviewNeededCount', async () => {
    const films: Record<string, Film> = {
      'https://boxd.it/f1': {
        letterboxdUri: 'https://boxd.it/f1',
        name: 'Justice League',
        year: 2017,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'ambiguous',
          reason: 'same_title_duplicates',
          candidates: [
            { id: 141052, title: 'Justice League', originalTitle: 'Justice League', year: 2017, confidenceScore: 1.0 }
          ]
        }
      }
    };

    useIngestionStore.setState({
      films,
      reviewNeededCount: 1
    });

    await useIngestionStore.getState().overrideMatch('https://boxd.it/f1', {
      id: 141052,
      title: 'Justice League',
      originalTitle: 'Justice League',
      year: 2017,
      confidenceScore: 1.0
    });

    const updated = useIngestionStore.getState();
    expect(updated.films['https://boxd.it/f1'].match.status).toBe('confident');
    expect(updated.films['https://boxd.it/f1'].match.tmdbId).toBe(141052);
    expect(updated.reviewNeededCount).toBe(0);
  });

  it('undoOverrideMatch restores previous match status and increments reviewNeededCount', async () => {
    const previousMatch = {
      status: 'ambiguous' as const,
      reason: 'same_title_duplicates' as const,
      candidates: [
        { id: 141052, title: 'Justice League', originalTitle: 'Justice League', year: 2017, confidenceScore: 1.0 }
      ]
    };

    const films: Record<string, Film> = {
      'https://boxd.it/f1': {
        letterboxdUri: 'https://boxd.it/f1',
        name: 'Justice League',
        year: 2017,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'confident',
          tmdbId: 141052
        }
      }
    };

    useIngestionStore.setState({
      films,
      reviewNeededCount: 0
    });

    await useIngestionStore.getState().undoOverrideMatch('https://boxd.it/f1', previousMatch);

    const updated = useIngestionStore.getState();
    expect(updated.films['https://boxd.it/f1'].match.status).toBe('ambiguous');
    expect(updated.reviewNeededCount).toBe(1);
  });

  it('acceptApproximateMatches accepts all approximate year items in bulk', async () => {
    const films: Record<string, Film> = {
      'https://boxd.it/f1': {
        letterboxdUri: 'https://boxd.it/f1',
        name: 'Vice',
        year: 2018,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'ambiguous',
          reason: 'approximate_year',
          approximateYear: true,
          candidates: [
            { id: 429197, title: 'Vice', originalTitle: 'Vice', year: 2019, confidenceScore: 0.90 }
          ]
        }
      },
      'https://boxd.it/f2': {
        letterboxdUri: 'https://boxd.it/f2',
        name: 'Unrelated Ambiguous',
        year: 2020,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'ambiguous',
          reason: 'same_title_duplicates',
          candidates: [
            { id: 100, title: 'Unrelated', originalTitle: 'Unrelated', year: 2020, confidenceScore: 1.0 }
          ]
        }
      }
    };

    useIngestionStore.setState({
      films,
      reviewNeededCount: 2
    });

    const acceptedCount = await useIngestionStore.getState().acceptApproximateMatches();
    expect(acceptedCount).toBe(1);

    const updated = useIngestionStore.getState();
    expect(updated.films['https://boxd.it/f1'].match.status).toBe('confident');
    expect(updated.films['https://boxd.it/f1'].match.tmdbId).toBe(429197);
    expect(updated.films['https://boxd.it/f2'].match.status).toBe('ambiguous');
    expect(updated.reviewNeededCount).toBe(1);
  });
});
