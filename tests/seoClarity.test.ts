import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase E: Microsoft Clarity Analytics & SEO Metadata', () => {
  const rootDir = path.resolve(__dirname, '..');
  const indexPath = path.join(rootDir, 'index.html');
  const robotsPath = path.join(rootDir, 'public', 'robots.txt');
  const sitemapPath = path.join(rootDir, 'public', 'sitemap.xml');
  const ogCardPath = path.join(rootDir, 'public', 'og-card.png');

  it('index.html integrates Microsoft Clarity with ID z1k4valpyq and privacy guard', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('z1k4valpyq');
    expect(html).toContain('https://www.clarity.ms/tag/');
    expect(html).toContain('navigator.doNotTrack');
    expect(html).toContain('data-clarity-mask="true"');
  });

  it('index.html contains full SEO, Open Graph and Twitter metadata for https://letterboxd.ddns.net', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('<link rel="canonical" href="https://letterboxd.ddns.net/" />');
    expect(html).toContain('<meta property="og:url" content="https://letterboxd.ddns.net/" />');
    expect(html).toContain('Letterboxd Pro Analytics — Deep, Private Film Stats & Insights');
    expect(html).toContain('https://letterboxd.ddns.net/og-card.png');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it('index.html provides static pre-rendered landing page shell for crawlers without client JS', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('Letterboxd Pro Analytics');
    expect(html).toContain('14 Dedicated Sections');
    expect(html).toContain('100% In-Browser Privacy');
    expect(html).toContain('Powered by TMDb');
    expect(html).toContain('<noscript>');
  });

  it('robots.txt allows crawling and specifies sitemap location', () => {
    const robots = fs.readFileSync(robotsPath, 'utf-8');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://letterboxd.ddns.net/sitemap.xml');
  });

  it('sitemap.xml contains canonical URL', () => {
    const sitemap = fs.readFileSync(sitemapPath, 'utf-8');
    expect(sitemap).toContain('https://letterboxd.ddns.net/');
  });

  it('og-card.png exists in public directory', () => {
    expect(fs.existsSync(ogCardPath)).toBe(true);
    const stats = fs.statSync(ogCardPath);
    expect(stats.size).toBeGreaterThan(1000);
  });
});
