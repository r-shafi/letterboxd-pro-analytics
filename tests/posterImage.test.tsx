import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PosterImage } from '../src/components/common/PosterImage.tsx';

describe('PosterImage: progressive retry and resilient fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders image successfully and applies visible opacity on load', () => {
    render(<PosterImage src="https://image.tmdb.org/t/p/w92/poster.jpg" alt="Test Poster" />);

    const img = screen.getByRole('img', { name: 'Test Poster' });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://image.tmdb.org/t/p/w92/poster.jpg');

    fireEvent.load(img);
    expect(img.className).toContain('opacity-100');
  });

  it('retries loading up to 3 times with progressive backoff on error before fallback', () => {
    render(
      <PosterImage
        src="https://image.tmdb.org/t/p/w92/failing_poster.jpg"
        alt="Failing Film"
        fallbackIcon={<div data-testid="custom-fallback">No Poster</div>}
      />
    );

    let img = screen.getByRole('img', { name: 'Failing Film' });

    // 1st error trigger -> schedules retry after 500ms
    fireEvent.error(img);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    img = screen.getByRole('img', { name: 'Failing Film' });
    expect(img.getAttribute('src')).toContain('retry=1');

    // 2nd error trigger -> schedules retry after 1500ms
    fireEvent.error(img);
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    img = screen.getByRole('img', { name: 'Failing Film' });
    expect(img.getAttribute('src')).toContain('retry=2');

    // 3rd error trigger -> schedules retry after 3000ms
    fireEvent.error(img);
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    img = screen.getByRole('img', { name: 'Failing Film' });
    expect(img.getAttribute('src')).toContain('retry=3');

    // 4th error trigger (after max 3 retries) -> displays fallback
    fireEvent.error(img);

    expect(screen.queryByRole('img', { name: 'Failing Film' })).not.toBeInTheDocument();
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
  });

  it('immediately displays fallback when src is null or empty', () => {
    render(
      <PosterImage
        src={null}
        alt="Missing Film"
        fallbackIcon={<span data-testid="null-fallback">Missing</span>}
      />
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('null-fallback')).toBeInTheDocument();
  });
});
