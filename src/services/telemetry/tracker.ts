/**
 * Privacy-First Telemetry & Analytics Tracker
 * Strictly adheres to zero-knowledge privacy:
 * - NO user film data, titles, usernames, reviews, or ratings ever leave the device.
 * - Only strictly allowlisted operational telemetry events are permitted.
 * - Honors Do Not Track (DNT) and localStorage opt-out flags.
 * - Completely disabled (no-op) when VITE_ANALYTICS_PROVIDER is unset.
 */

import { CONFIG } from '../../config/env.ts';

export type TelemetryEvent =
  | { name: 'pageview'; properties?: { path: string } }
  | { name: 'import_start'; properties: { source: 'zip' | 'csv' | 'demo' } }
  | {
      name: 'import_complete';
      properties: {
        filmCountBucket: '<100' | '100-500' | '500-1000' | '1000-5000' | '5000+';
        durationSec: number;
      };
    }
  | { name: 'import_error'; properties: { errorType: string } }
  | { name: 'filter_change'; properties: { range: string } }
  | { name: 'share_card_generated'; properties: { format: 'square' | 'story' | 'url_compact' | 'url_full' } }
  | { name: 'pwa_installed'; properties?: Record<string, never> }
  | { name: 'byok_enabled'; properties?: Record<string, never> };

const FORBIDDEN_PROPERTY_KEYS = new Set([
  'title',
  'name',
  'film',
  'filmid',
  'filmuniqueid',
  'username',
  'email',
  'review',
  'rating',
  'tag',
  'comment',
  'location'
]);

export function getFilmCountBucket(count: number): '<100' | '100-500' | '500-1000' | '1000-5000' | '5000+' {
  if (count < 100) return '<100';
  if (count <= 500) return '100-500';
  if (count <= 1000) return '500-1000';
  if (count <= 5000) return '1000-5000';
  return '5000+';
}

export class TelemetryTracker {
  private isOptedOut(): boolean {
    if (typeof window === 'undefined') return true;

    // Check Do Not Track browser header / flag
    if (
      window.navigator?.doNotTrack === '1' ||
      (window as unknown as { doNotTrack?: string }).doNotTrack === '1'
    ) {
      return true;
    }

    try {
      return localStorage.getItem('analytics:optout') === 'true';
    } catch {
      return false;
    }
  }

  public setOptOut(optOut: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('analytics:optout', optOut ? 'true' : 'false');
    } catch {
      // ignore localStorage errors
    }
  }

  public isEnabled(): boolean {
    if (!CONFIG.analyticsProvider) return false;
    if (this.isOptedOut()) return false;
    return true;
  }

  public track<E extends TelemetryEvent>(event: E): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    // Strict validation against forbidden personal fields
    if (event.properties) {
      for (const key of Object.keys(event.properties)) {
        if (FORBIDDEN_PROPERTY_KEYS.has(key.toLowerCase())) {
          console.warn(`[Telemetry] Rejected event containing forbidden property: ${key}`);
          return false;
        }
      }
    }

    const provider = CONFIG.analyticsProvider.toLowerCase();

    try {
      switch (provider) {
        case 'plausible':
          if (typeof window !== 'undefined' && (window as unknown as { plausible?: (name: string, opt: object) => void }).plausible) {
            (window as unknown as { plausible: (name: string, opt: object) => void }).plausible(event.name, {
              props: event.properties
            });
          }
          break;

        case 'umami':
          if (typeof window !== 'undefined' && (window as unknown as { umami?: { track: (name: string, data?: object) => void } }).umami) {
            (window as unknown as { umami: { track: (name: string, data?: object) => void } }).umami.track(event.name, event.properties);
          }
          break;

        case 'custom':
          if (CONFIG.analyticsApiHost && typeof fetch !== 'undefined') {
            fetch(CONFIG.analyticsApiHost, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: event.name,
                properties: event.properties,
                timestamp: Date.now()
              }),
              keepalive: true
            }).catch(() => {
              // Silently ignore network failures in telemetry
            });
          }
          break;

        default:
          break;
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const tracker = new TelemetryTracker();
