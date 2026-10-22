import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { generateSyntheticExportFiles } from '../src/services/synthetic/generator.ts';
import { processLetterboxdExport } from '../src/services/parser/csvParser.ts';
import { calculateAnalyticsSnapshot } from '../src/services/analytics/engine.ts';

// Sections
import { S1SnapshotSection } from '../src/components/sections/S1SnapshotSection.tsx';
import { S3VolumeSection } from '../src/components/sections/S3VolumeSection.tsx';
import { S4RatingsSection } from '../src/components/sections/S4RatingsSection.tsx';
import { S5CrowdSection } from '../src/components/sections/S5CrowdSection.tsx';
import { S6TasteSection } from '../src/components/sections/S6TasteSection.tsx';
import { S7PeopleSection } from '../src/components/sections/S7PeopleSection.tsx';
import { S8WorldSection } from '../src/components/sections/S8WorldSection.tsx';
import { S9GenresDecadesSection } from '../src/components/sections/S9GenresDecadesSection.tsx';
import { S10RewatchesSection } from '../src/components/sections/S10RewatchesSection.tsx';
import { S11WordsTagsSection } from '../src/components/sections/S11WordsTagsSection.tsx';
import { S12WatchlistSection } from '../src/components/sections/S12WatchlistSection.tsx';
import { S13RecordsSection } from '../src/components/sections/S13RecordsSection.tsx';
import { ControlBar } from '../src/components/dashboard/ControlBar.tsx';
import { Header } from '../src/components/layout/Header.tsx';
import { Footer } from '../src/components/layout/Footer.tsx';

describe('Phase C: UI & Plain-Language Overhaul', () => {
  const files = generateSyntheticExportFiles({ filmCount: 50 });
  const filesMap = new Map<string, string>();
  for (const [name, u8] of Object.entries(files)) {
    filesMap.set(name, new TextDecoder().decode(u8));
  }
  const parsed = processLetterboxdExport(filesMap);
  const snapshot = calculateAnalyticsSnapshot(
    parsed.films,
    parsed.entries,
    parsed.lists,
    parsed.profile,
    { range: 'all' }
  );

  it('1. Secondary ControlBar matches main layout container classes and padding', () => {
    const { container: controlBarContainer } = render(
      <ControlBar
        filter={{ range: 'all' }}
        onFilterChange={() => {}}
        availableYears={[2023, 2024]}
        totalFilms={50}
        dateUnknownCount={0}
        matchedCount={50}
      />
    );

    const innerDiv = controlBarContainer.querySelector('.max-w-7xl');
    expect(innerDiv).not.toBeNull();
    expect(innerDiv?.className).toContain('mx-auto');
    expect(innerDiv?.className).toContain('px-4');
    expect(innerDiv?.className).toContain('sm:px-6');
    expect(innerDiv?.className).toContain('lg:px-8');

    // Compare with Header
    const { container: headerContainer } = render(
      <Header
        onOpenSettings={() => {}}
        onOpenPrivacy={() => {}}
      />
    );
    const headerInner = headerContainer.querySelector('.max-w-7xl');
    expect(headerInner?.className).toContain('mx-auto');
    expect(headerInner?.className).toContain('px-4');
    expect(headerInner?.className).toContain('sm:px-6');
    expect(headerInner?.className).toContain('lg:px-8');
  });

  it('2. Footer author is Shafi Rayhan with proton mail attribution', () => {
    render(<Footer onOpenPrivacy={() => {}} />);
    expect(screen.getByText('Shafi Rayhan')).toBeInTheDocument();
  });

  it('3. Activity Calendar: Year Switcher, month labels, visible 0-day borders, matching legend, and golden --today highlight', () => {
    const { container } = render(
      <S3VolumeSection
        volume={snapshot.s3Volume}
        onSelectDay={() => {}}
        onSelectMarathon={() => {}}
      />
    );

    // Year Switcher exists
    const switcher = screen.getByTestId('calendar-year-switcher');
    expect(switcher).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trailing 365' })).toBeInTheDocument();

    // Month headers are rendered (e.g. Jan, Feb, Mar...)
    const monthHeaderRow = screen.getByTestId('calendar-month-headers');
    expect(monthHeaderRow).toBeInTheDocument();
    expect(monthHeaderRow.textContent).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);

    // 0-film days have visible fill and border (distinguishable from card background #1b2026)
    const zeroDayCells = container.querySelectorAll<HTMLElement>('[data-count="0"]');
    expect(zeroDayCells.length).toBeGreaterThan(0);
    const firstZero = zeroDayCells[0];
    expect(firstZero.style.backgroundColor).toBe('rgb(34, 40, 50)'); // #222832
    expect(firstZero.style.border).toContain('rgb(47, 56, 70)'); // #2f3846

    // Legend swatches match cell shape and classes
    const legend = screen.getByTestId('calendar-legend');
    expect(legend).toBeInTheDocument();
    const legendSwatches = legend.querySelectorAll('.h-3.w-3');
    expect(legendSwatches.length).toBe(4);
    legendSwatches.forEach((swatch) => {
      expect(swatch.className).toContain('rounded-sm');
      expect(swatch.className).not.toContain('rounded-full');
    });

    // Today cell has golden highlight test id
    const todayCell = screen.getByTestId('calendar-cell-today');
    expect(todayCell).toBeInTheDocument();
    expect(todayCell.className).toContain('ring-[#e5a00d]');
  });

  it('4. Plain Language Everywhere: No raw math jargon in user-facing sections', () => {
    const { container } = render(
      <div>
        <S1SnapshotSection
          snapshot={snapshot.s1Snapshot}
          profile={parsed.profile}
          filmsRecord={parsed.films}
          onSelectFilm={() => {}}
        />
        <S3VolumeSection
          volume={snapshot.s3Volume}
          onSelectDay={() => {}}
          onSelectMarathon={() => {}}
        />
        <S4RatingsSection
          ratings={snapshot.s4Ratings}
          onSelectRating={() => {}}
          onSelectFilm={() => {}}
        />
        <S5CrowdSection
          crowd={snapshot.s5Crowd}
          onSelectFilm={() => {}}
        />
        <S6TasteSection
          taste={snapshot.s6Taste}
          overallMean={snapshot.s1Snapshot.averageRating}
        />
        <S12WatchlistSection
          watchlist={snapshot.s12Watchlist}
          onSelectFilm={() => {}}
        />
        <S13RecordsSection
          records={snapshot.s13Records}
          onSelectFilm={() => {}}
        />
      </div>
    );

    const fullText = container.textContent || '';

    // Banned math jargon per spec:
    expect(fullText).not.toMatch(/Pearson Coefficient/i);
    expect(fullText).not.toMatch(/Bayesian shrinkage \(k=5\)/i);
    expect(fullText).not.toMatch(/Shannon Entropy/i);
    expect(fullText).not.toMatch(/\bMAE\b/);
  });

  it('5. Clean TMDb Mentions: User sections must NOT mention TMDb outside allowed locations', () => {
    const { container } = render(
      <div>
        <S1SnapshotSection
          snapshot={snapshot.s1Snapshot}
          profile={parsed.profile}
          filmsRecord={parsed.films}
          onSelectFilm={() => {}}
        />
        <S3VolumeSection
          volume={snapshot.s3Volume}
          onSelectDay={() => {}}
          onSelectMarathon={() => {}}
        />
        <S4RatingsSection
          ratings={snapshot.s4Ratings}
          onSelectRating={() => {}}
          onSelectFilm={() => {}}
        />
        <S5CrowdSection
          crowd={snapshot.s5Crowd}
          onSelectFilm={() => {}}
        />
        <S6TasteSection
          taste={snapshot.s6Taste}
          overallMean={snapshot.s1Snapshot.averageRating}
        />
        <S7PeopleSection
          people={snapshot.s7People}
          overallMean={snapshot.s1Snapshot.averageRating}
          onSelectPerson={() => {}}
        />
        <S8WorldSection
          world={snapshot.s8World}
          onSelectGroup={() => {}}
        />
        <S9GenresDecadesSection
          genresDecades={snapshot.s9Genres}
          onSelectFilm={() => {}}
        />
        <S10RewatchesSection
          rewatches={snapshot.s10Rewatches}
          onSelectFilm={() => {}}
        />
        <S11WordsTagsSection
          wordsLists={snapshot.s11WordsLists}
        />
        <S12WatchlistSection
          watchlist={snapshot.s12Watchlist}
          onSelectFilm={() => {}}
        />
        <S13RecordsSection
          records={snapshot.s13Records}
          onSelectFilm={() => {}}
        />
      </div>
    );

    const fullText = container.textContent || '';
    // Must NOT contain "TMDb" in user sections
    expect(fullText).not.toMatch(/TMDb Coverage/i);
    expect(fullText).not.toMatch(/The TMDb Consensus/i);
    expect(fullText).not.toMatch(/TMDb popularity/i);
    expect(fullText).not.toMatch(/Most Popular TMDb Title/i);
    expect(fullText).not.toMatch(/Loading runtimes from TMDb/i);
  });
});
