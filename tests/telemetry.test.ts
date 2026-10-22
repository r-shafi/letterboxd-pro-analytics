/**
 * Privacy & Telemetry Guard Tests
 * Verifies strict zero-knowledge privacy guarantees:
 * - No user film titles, usernames, reviews, ratings or tags are ever transmitted.
 * - Do Not Track (DNT) and local opt-out are strictly honored.
 * - Telemetry is disabled when provider is unset.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { tracker, TelemetryEvent, getFilmCountBucket } from '../src/services/telemetry/tracker.ts';
import { CONFIG } from '../src/config/env.ts';

describe('Phase 5: Privacy & Telemetry Guard Tests', () => {
  const originalProvider = CONFIG.analyticsProvider;
  const originalHost = CONFIG.analyticsApiHost;

  beforeEach(() => {
    localStorage.clear();
    tracker.setOptOut(false);
    CONFIG.analyticsProvider = '';
    CONFIG.analyticsApiHost = '';
  });

  afterEach(() => {
    CONFIG.analyticsProvider = originalProvider;
    CONFIG.analyticsApiHost = originalHost;
    vi.restoreAllMocks();
  });

  describe('Provider Enablement & Opt-Out Checks', () => {
    it('is a complete no-op when VITE_ANALYTICS_PROVIDER is unset', () => {
      CONFIG.analyticsProvider = '';
      expect(tracker.isEnabled()).toBe(false);
      const res = tracker.track({ name: 'pageview', properties: { path: '/' } });
      expect(res).toBe(false);
    });

    it('honors localStorage opt-out setting', () => {
      CONFIG.analyticsProvider = 'custom';
      CONFIG.analyticsApiHost = 'https://telemetry.example.com/api';
      expect(tracker.isEnabled()).toBe(true);

      tracker.setOptOut(true);
      expect(tracker.isEnabled()).toBe(false);
      const res = tracker.track({ name: 'pageview', properties: { path: '/' } });
      expect(res).toBe(false);
    });

    it('honors browser Do Not Track (DNT) signal', () => {
      CONFIG.analyticsProvider = 'custom';
      CONFIG.analyticsApiHost = 'https://telemetry.example.com/api';

      Object.defineProperty(window.navigator, 'doNotTrack', {
        value: '1',
        configurable: true
      });

      expect(tracker.isEnabled()).toBe(false);
      const res = tracker.track({ name: 'pageview', properties: { path: '/' } });
      expect(res).toBe(false);

      Object.defineProperty(window.navigator, 'doNotTrack', {
        value: '0',
        configurable: true
      });
      expect(tracker.isEnabled()).toBe(true);
    });
  });

  describe('Film Count Bucketing', () => {
    it('buckets film counts to prevent user library fingerprinting', () => {
      expect(getFilmCountBucket(15)).toBe('<100');
      expect(getFilmCountBucket(99)).toBe('<100');
      expect(getFilmCountBucket(100)).toBe('100-500');
      expect(getFilmCountBucket(499)).toBe('100-500');
      expect(getFilmCountBucket(500)).toBe('100-500');
      expect(getFilmCountBucket(750)).toBe('500-1000');
      expect(getFilmCountBucket(2500)).toBe('1000-5000');
      expect(getFilmCountBucket(12000)).toBe('5000+');
    });
  });

  describe('Privacy Field Guard', () => {
    it('allows clean operational telemetry events', () => {
      CONFIG.analyticsProvider = 'custom';
      CONFIG.analyticsApiHost = 'https://telemetry.example.com/api';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true })))
      );

      const success = tracker.track({
        name: 'import_complete',
        properties: {
          filmCountBucket: '500-1000',
          durationSec: 12
        }
      });

      expect(success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects and discards events containing user film titles or private content', () => {
      CONFIG.analyticsProvider = 'custom';
      CONFIG.analyticsApiHost = 'https://telemetry.example.com/api';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true })))
      );

      // Attempt to sneak user title / rating into telemetry event
      const taintedEvent = {
        name: 'import_complete',
        properties: {
          filmCountBucket: '500-1000',
          durationSec: 12,
          filmTitle: 'The Godfather',
          rating: 5,
          review: 'Personal masterpiece review'
        }
      } as unknown as TelemetryEvent;

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const success = tracker.track(taintedEvent);
      expect(success).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });
});
