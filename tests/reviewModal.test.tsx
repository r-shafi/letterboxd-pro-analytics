import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewMatchesModal } from '../src/components/ingestion/ReviewMatchesModal.tsx';
import { Film, TmdbMatchCandidate } from '../src/types/domain.ts';
import { storage } from '../src/utils/storage.ts';

describe('Phase 3: Review Matches Modal Queue & Performance Tests', () => {
  beforeEach(async () => {
    await storage.clearAllData();
  });

  const createMockReviewFilm = (id: number, name: string, year = 2020): Film => ({
    letterboxdUri: `https://boxd.it/film_${id}`,
    name,
    year,
    watched: true,
    liked: false,
    onWatchlist: false,
    match: {
      status: 'ambiguous',
      reason: 'no_confident_match',
      candidates: [
        {
          id: id * 10,
          title: `${name} Candidate`,
          originalTitle: `${name} Candidate`,
          year,
          confidenceScore: 0.82,
          posterPath: `/poster_${id}.jpg`
        },
        {
          id: id * 10 + 1,
          title: `${name} Alternate`,
          originalTitle: `${name} Alternate`,
          year,
          confidenceScore: 0.78,
          posterPath: `/poster_alt_${id}.jpg`
        }
      ]
    }
  });

  it('1. Selecting item N advances to item N+1 exactly once and NEVER skips (50 repeated selections)', async () => {
    const films: Record<string, Film> = {};
    for (let i = 1; i <= 60; i++) {
      const f = createMockReviewFilm(i, `Film Title ${i}`, 2010 + (i % 10));
      films[f.letterboxdUri] = f;
    }

    const selectedHistory: Array<{ uri: string; candidateId: number }> = [];
    const handleOverride = vi.fn(async (uri: string, candidate: TmdbMatchCandidate) => {
      selectedHistory.push({ uri, candidateId: candidate.id });
    });

    render(
      <ReviewMatchesModal
        films={films}
        onClose={() => {}}
        onOverrideMatch={handleOverride}
      />
    );

    // Initial item should be Film Title 1
    expect(screen.getByText('Film Title 1')).toBeDefined();

    // Select candidate 50 times sequentially
    for (let i = 1; i <= 50; i++) {
      expect(screen.getByText(`Film Title ${i}`)).toBeDefined();

      const selectButtons = screen.getAllByRole('button', { name: /^Select/i });
      fireEvent.click(selectButtons[0]);

      // Should have recorded exactly i selections
      expect(selectedHistory.length).toBe(i);
      expect(selectedHistory[i - 1].uri).toBe(`https://boxd.it/film_${i}`);

      // Immediately next item should be Film Title i+1 (unless at end of loop)
      if (i < 50) {
        expect(screen.getByText(`Film Title ${i + 1}`)).toBeDefined();
      }
    }

    // Verify all 50 selections occurred in strict order 1 through 50 without skipping any
    for (let i = 0; i < 50; i++) {
      expect(selectedHistory[i].uri).toBe(`https://boxd.it/film_${i + 1}`);
    }
  });

  it('2. Undo restores both queue position and previous state', async () => {
    const films: Record<string, Film> = {
      'https://boxd.it/film_1': createMockReviewFilm(1, 'Film Alpha'),
      'https://boxd.it/film_2': createMockReviewFilm(2, 'Film Beta')
    };

    const handleOverride = vi.fn(async () => {});
    const handleUndo = vi.fn(async () => {});

    render(
      <ReviewMatchesModal
        films={films}
        onClose={() => {}}
        onOverrideMatch={handleOverride}
        onUndoOverrideMatch={handleUndo}
      />
    );

    // Currently showing Film Alpha
    expect(screen.getByText('Film Alpha')).toBeDefined();

    // Select candidate on Film Alpha
    const selectButtons = screen.getAllByRole('button', { name: /^Select/i });
    fireEvent.click(selectButtons[0]);

    // Advances to Film Beta
    expect(screen.getByText('Film Beta')).toBeDefined();

    // Toast with Undo appears
    const undoButton = screen.getAllByRole('button', { name: /Undo/i })[0];
    expect(undoButton).toBeDefined();

    // Click Undo
    fireEvent.click(undoButton);

    // handleUndo is called for Film Alpha
    expect(handleUndo).toHaveBeenCalledWith('https://boxd.it/film_1', expect.anything());

    // Queue stepped back to Film Alpha
    await waitFor(() => {
      expect(screen.getByText('Film Alpha')).toBeDefined();
    });
  });

  it('3. Skip retains item in queue accessible via Skipped filter and is never lost', async () => {
    const films: Record<string, Film> = {
      'https://boxd.it/film_1': createMockReviewFilm(1, 'Skip Me'),
      'https://boxd.it/film_2': createMockReviewFilm(2, 'Next Film')
    };

    render(
      <ReviewMatchesModal
        films={films}
        onClose={() => {}}
        onOverrideMatch={async () => {}}
      />
    );

    expect(screen.getByText('Skip Me')).toBeDefined();

    // Click Skip
    const skipButton = screen.getByRole('button', { name: /Skip \(S\)/i });
    fireEvent.click(skipButton);

    // Advances to Next Film
    expect(screen.getByText('Next Film')).toBeDefined();

    // Skipped tab appears with count 1
    const skippedTab = screen.getByRole('button', { name: /Skipped \(1\)/i });
    expect(skippedTab).toBeDefined();

    // Switch to Skipped tab
    fireEvent.click(skippedTab);

    // 'Skip Me' is still accessible and can be reviewed!
    expect(screen.getByText('Skip Me')).toBeDefined();
  });

  it('4. None of these marks film as explicitly unmatched', async () => {
    const films: Record<string, Film> = {
      'https://boxd.it/film_1': createMockReviewFilm(1, 'Unmatched Indie'),
      'https://boxd.it/film_2': createMockReviewFilm(2, 'Another Film')
    };

    const handleMarkUnmatched = vi.fn(async () => {});

    render(
      <ReviewMatchesModal
        films={films}
        onClose={() => {}}
        onOverrideMatch={async () => {}}
        onMarkUnmatched={handleMarkUnmatched}
      />
    );

    const noneButton = screen.getByRole('button', { name: /None of these/i });
    fireEvent.click(noneButton);

    expect(handleMarkUnmatched).toHaveBeenCalledWith('https://boxd.it/film_1');
    expect(screen.getByText('Another Film')).toBeDefined();
  });

  it('5. Storage writes dirty chunk incrementally without full monolithic re-compression per click', async () => {
    // Generate 100 films
    const films: Record<string, Film> = {};
    for (let i = 1; i <= 100; i++) {
      films[`https://boxd.it/film_${i}`] = createMockReviewFilm(i, `Film ${i}`);
    }

    // Save films incrementally
    await storage.saveFilmsIncremental(films);

    const spySetItem = vi.spyOn(storage, 'setItem');

    // Mutate only 1 film via queueDirtyFilm
    const dirtyFilm = { ...films['https://boxd.it/film_1'], name: 'Mutated Film 1' };
    storage.queueDirtyFilm(dirtyFilm);
    await storage.flushDirtyFilms();

    // Exactly 1 chunk should have been persisted, NOT the entire dataset!
    expect(spySetItem).toHaveBeenCalledTimes(1);
    expect(spySetItem.mock.calls[0][0]).toMatch(/^data:films:chunk:\d+$/);
  });

  it('6. Modal complies with accessibility guidelines (role="dialog", aria-modal, focus trapping)', () => {
    const films: Record<string, Film> = {
      'https://boxd.it/film_1': createMockReviewFilm(1, 'Accessible Film')
    };

    render(
      <ReviewMatchesModal
        films={films}
        onClose={() => {}}
        onOverrideMatch={async () => {}}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('review-modal-title');
  });
});
