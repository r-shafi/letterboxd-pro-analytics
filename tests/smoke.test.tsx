import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../src/main.tsx';
import { CONFIG } from '../src/config/env.ts';

describe('Phase 1: App Smoke & Layout Shell', () => {
  it('loads configuration constants with valid defaults', () => {
    expect(CONFIG.siteName).toBe('Letterboxd Pro Analytics');
    expect(CONFIG.authorName).toBe('R. Shafi');
    expect(CONFIG.tmdbFallbackKey).toBe('1426684c151e5ca03cfd5a6952e73c46');
  });

  it('renders the application header and brand title', () => {
    render(<App />);
    const brandTitles = screen.getAllByText('Letterboxd Pro Analytics');
    expect(brandTitles.length).toBeGreaterThan(0);
  });

  it('renders footer attribution and legal disclaimer', () => {
    render(<App />);
    expect(
      screen.getByText(/This product uses the TMDb API but is not endorsed or certified by TMDb/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Not affiliated with, associated with, authorized by/i)
    ).toBeInTheDocument();
  });
});
