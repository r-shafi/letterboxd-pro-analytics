import { describe, it, expect } from 'vitest';
import {
  encodeSharedSnapshot,
  decodeSharedSnapshot,
  sharedPayloadToSnapshot,
  uint8ArrayToBase64Url,
  base64UrlToUint8Array
} from '../src/services/share/urlShare.ts';
import { generateDemoDataset } from '../src/services/synthetic/demoLoader.ts';
import { calculateAnalyticsSnapshot } from '../src/services/analytics/engine.ts';

describe('Serverless URL Fragment Share (#v1=...) & Security', () => {
  const demo = generateDemoDataset(100);
  const snapshot = calculateAnalyticsSnapshot(
    demo.films,
    demo.entries,
    demo.lists,
    demo.profile,
    { range: 'all' }
  );

  it('base64url roundtrip converts Uint8Array correctly', () => {
    const original = new Uint8Array([0, 15, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
    const b64 = uint8ArrayToBase64Url(original);
    expect(b64).not.toContain('+');
    expect(b64).not.toContain('/');
    expect(b64).not.toContain('=');

    const decoded = base64UrlToUint8Array(b64);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('encodes and decodes compact snapshot within 2,000 characters', () => {
    const hash = encodeSharedSnapshot(snapshot, demo.profile, 'compact');
    expect(hash.startsWith('#v1=')).toBe(true);
    expect(hash.length).toBeLessThanOrEqual(2000);

    const decoded = decodeSharedSnapshot(hash);
    expect(decoded.type).toBe('compact');
    if (decoded.type === 'compact') {
      expect(decoded.v).toBe(1);
      expect(decoded.u).toBe(demo.profile?.username || 'cinema_lover');
      expect(decoded.tf).toBe(snapshot.s1Snapshot.totalFilms);
      expect(decoded.ar).toBe(snapshot.s1Snapshot.averageRating);
      expect(decoded.tg.length).toBeGreaterThan(0);
    }
  });

  it('encodes and decodes full snapshot within 8,000 characters', () => {
    const hash = encodeSharedSnapshot(snapshot, demo.profile, 'full');
    expect(hash.startsWith('#v1=')).toBe(true);
    expect(hash.length).toBeLessThanOrEqual(8000);

    const decoded = decodeSharedSnapshot(hash);
    expect(decoded.type).toBe('full');
    if (decoded.type === 'full') {
      expect(decoded.v).toBe(1);
      expect(decoded.u).toBe(demo.profile?.username || 'cinema_lover');
      expect(decoded.s1.totalFilms).toBe(snapshot.s1Snapshot.totalFilms);
      expect(decoded.s4.mean).toBe(snapshot.s4Ratings.mean);
      expect(decoded.s7.directors.length).toBeGreaterThan(0);
    }
  });

  it('reconstructs valid renderable snapshot from compact payload', () => {
    const hash = encodeSharedSnapshot(snapshot, demo.profile, 'compact');
    const decoded = decodeSharedSnapshot(hash);
    const { snapshot: reconstructed, profile } = sharedPayloadToSnapshot(decoded);

    expect(profile.username).toBe(demo.profile?.username);
    expect(reconstructed.s1Snapshot.totalFilms).toBe(snapshot.s1Snapshot.totalFilms);
    expect(reconstructed.s1Snapshot.averageRating).toBe(snapshot.s1Snapshot.averageRating);
    expect(reconstructed.s7People.directors.length).toBeGreaterThan(0);
    expect(reconstructed.s9Genres.genres.length).toBeGreaterThan(0);
    expect(reconstructed.s3Volume.trailing365Calendar.length).toBe(365);
  });

  it('reconstructs valid renderable snapshot from full payload', () => {
    const hash = encodeSharedSnapshot(snapshot, demo.profile, 'full');
    const decoded = decodeSharedSnapshot(hash);
    const { snapshot: reconstructed, films } = sharedPayloadToSnapshot(decoded);

    expect(reconstructed.s1Snapshot.totalFilms).toBe(snapshot.s1Snapshot.totalFilms);
    expect(reconstructed.s3Volume.yearlyVolume.length).toBe(snapshot.s3Volume.yearlyVolume.length);
    expect(reconstructed.s4Ratings.histogram.length).toBe(10);
    expect(reconstructed.s5Crowd.contrarianIndex).toBe(snapshot.s5Crowd.contrarianIndex);
    expect(reconstructed.s3Volume.trailing365Calendar.length).toBe(365);
    expect(Object.keys(reconstructed.s3Volume.yearlyCalendars).length).toBeGreaterThan(0);

    const totalActiveDaysOriginal = snapshot.s3Volume.trailing365Calendar.filter((c) => c.count > 0).length;
    const totalActiveDaysReconstructed = reconstructed.s3Volume.trailing365Calendar.filter((c) => c.count > 0).length;
    expect(totalActiveDaysReconstructed).toBe(totalActiveDaysOriginal);

    expect(Object.keys(films).length).toBeGreaterThan(0);
  });

  it('safely rejects invalid base64url characters', () => {
    expect(() => decodeSharedSnapshot('#v1=invalid!characters@here$%')).toThrow();
  });

  it('safely rejects corrupted compressed data', () => {
    expect(() => decodeSharedSnapshot('#v1=YWJjZGVmZ2hpams')).toThrow();
  });

  it('rejects oversized fragment strings over safety limit', () => {
    const oversized = '#v1=' + 'A'.repeat(15000);
    expect(() => decodeSharedSnapshot(oversized)).toThrow('Fragment payload size exceeds safety bounds');
  });

  it('sanitizes HTML tags from username and titles', () => {
    const maliciousProfile = {
      ...demo.profile!,
      username: '<script>alert("xss")</script>alice'
    };
    const hash = encodeSharedSnapshot(snapshot, maliciousProfile, 'compact');
    const decoded = decodeSharedSnapshot(hash);
    expect(decoded.u).not.toContain('<script>');
    expect(decoded.u).toContain('alice');
  });

  it('rejects prototype pollution attacks', () => {
    const maliciousJson = '{"v":1,"type":"compact","__proto__":{"isAdmin":true},"u":"attacker"}';
    const def = require('fflate').deflateSync(require('fflate').strToU8(maliciousJson), { level: 9 });
    const b64 = uint8ArrayToBase64Url(def);
    expect(() => decodeSharedSnapshot('#v1=' + b64)).toThrow('Malicious object properties detected');
  });
});
