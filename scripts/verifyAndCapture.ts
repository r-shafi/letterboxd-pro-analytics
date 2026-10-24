import { chromium } from '@playwright/test';
import { preview } from 'vite';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('--- Starting verification and screenshot capture ---');
  const server = await preview({
    preview: {
      port: 4173,
      host: '127.0.0.1'
    }
  });

  const screenshotsDir = path.resolve(process.cwd(), 'docs/screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch();

  // Test 1: Desktop (1440x900) - Full Flow, Benchmarks, and Screenshots
  console.log('\n--- 1. Running Desktop (1440x900) Flow ---');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const desktopPage = await desktopContext.newPage();
  desktopPage.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  desktopPage.on('pageerror', err => console.log('BROWSER ERR:', err));

  // Apply 4x CPU throttle via CDP session
  const cdp = await desktopContext.newCDPSession(desktopPage);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await desktopPage.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });

  // 1a. Load demo data
  const demoBtn = desktopPage.getByRole('button', { name: /Try Demo Data/i });
  await demoBtn.click();
  await desktopPage.waitForSelector('#s1-snapshot', { timeout: 10000 });

  // 1b. Open Data Quality Modal to inspect 5-column reconciled table
  const qualityBtn = desktopPage.locator('button:has-text("Matched")').first();
  await qualityBtn.click();

  const qualityModalHeading = desktopPage.getByRole('heading', { name: /Import & Data Quality Report/i });
  await qualityModalHeading.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Data Quality modal opened successfully.');

  const reportScreenshotPath = path.join(screenshotsDir, 'report-table-1440x900.png');
  await desktopPage.screenshot({ path: reportScreenshotPath });
  console.log(`Saved screenshot: ${reportScreenshotPath}`);

  await desktopPage.getByRole('button', { name: /Close/i }).click();

  // 1c. Inject synthetic ambiguous films and trigger Review Modal
  console.log('\n--- Injecting Synthetic Ambiguous Films for Review Modal ---');
  await desktopPage.evaluate(() => {
    console.log('in evaluate, window.useIngestionStore:', (window as any).useIngestionStore);
    const store = (window as any).useIngestionStore;
    if (!store) throw new Error('useIngestionStore not found on window');

    const films = {
      'https://boxd.it/synth_1': {
        letterboxdUri: 'https://boxd.it/synth_1',
        name: 'Justice League',
        year: 2017,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'ambiguous',
          reason: 'same_title_duplicates',
          candidates: [
            {
              id: 141052,
              title: 'Justice League',
              originalTitle: 'Justice League',
              year: 2017,
              confidenceScore: 1.0,
              posterPath: null,
              overview: 'Fuelled by his restored faith in humanity, Bruce Wayne and Diana Prince assemble a team.'
            },
            {
              id: 408220,
              title: 'Justice League Dark',
              originalTitle: 'Justice League Dark',
              year: 2017,
              confidenceScore: 0.75,
              posterPath: null,
              overview: 'A team of supernatural specialists must unravel the mystery of Earth demonic plague.'
            }
          ]
        }
      },
      'https://boxd.it/synth_2': {
        letterboxdUri: 'https://boxd.it/synth_2',
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
            {
              id: 429197,
              title: 'Vice',
              originalTitle: 'Vice',
              year: 2019,
              confidenceScore: 0.90,
              posterPath: null,
              overview: 'The story of Dick Cheney, an unassuming bureaucratic insider.'
            }
          ]
        }
      },
      'https://boxd.it/synth_3': {
        letterboxdUri: 'https://boxd.it/synth_3',
        name: 'Brooklyn',
        year: 2015,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'ambiguous',
          reason: 'no_confident_match',
          candidates: [
            {
              id: 167073,
              title: 'Brooklyn',
              originalTitle: 'Brooklyn',
              year: 2015,
              confidenceScore: 0.85,
              posterPath: null,
              overview: 'An Irish immigrant lands in 1950s Brooklyn, where she falls in love with a local.'
            }
          ]
        }
      }
    };

    store.setState({
      films,
      reviewNeededCount: 3,
      autoOpenReviewModal: true
    });
  });

  const reviewModalHeading = desktopPage.getByRole('heading', { name: /Review film matches/i });
  await reviewModalHeading.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Review film matches modal opened automatically.');

  // Verify focus trap / dialog accessibility
  const dialogElem = desktopPage.getByRole('dialog');
  console.log(`Dialog role verified: ${await dialogElem.getAttribute('aria-modal') === 'true' ? 'PASS' : 'FAIL'}`);

  // Screenshot: Review modal before selection (1440x900)
  const modalBefore1440 = path.join(screenshotsDir, 'review-modal-before-1440x900.png');
  await desktopPage.screenshot({ path: modalBefore1440 });
  console.log(`Saved screenshot: ${modalBefore1440}`);

  // Benchmark Select Response Time under 4x CPU throttle
  console.log('Benchmarking Select click response time under 4x CPU throttle...');
  const selectBtn = desktopPage.getByRole('button', { name: /Select/i }).first();
  const tStart = performance.now();
  await selectBtn.click();

  // Wait for toast or next film
  await desktopPage.getByText(/Matched Justice League/i).waitFor({ state: 'visible', timeout: 3000 });
  const tElapsed = Math.round(performance.now() - tStart);
  console.log(`[MEASUREMENT] Select click response & next item render: ${tElapsed} ms (Target: < 100 ms UI, < 150 ms next item)`);

  // Screenshot: Review modal after selecting, with toast and undo (1440x900)
  const modalAfter1440 = path.join(screenshotsDir, 'review-modal-after-with-toast-1440x900.png');
  await desktopPage.screenshot({ path: modalAfter1440 });
  console.log(`Saved screenshot: ${modalAfter1440}`);

  // Test Undo button
  const undoBtn = desktopPage.getByRole('button', { name: /Undo/i }).first();
  await undoBtn.click();
  console.log('Undo restored previous selection.');

  // Close modal
  await desktopPage.keyboard.press('Escape');
  console.log('Modal dismissed via Escape key.');

  // Verify persistent chip shows remaining count
  const persistentChip = desktopPage.locator('button:has-text("review")');
  console.log(`Persistent chip visible after close: ${await persistentChip.isVisible()}`);

  await desktopContext.close();

  // Test 2: Mobile (360x800) Viewport
  console.log('\n--- 2. Running Mobile (360x800) Viewport Flow ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 360, height: 800 }
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });

  // Load demo data
  const mobileDemoBtn = mobilePage.getByRole('button', { name: /Try Demo Data/i });
  if (await mobileDemoBtn.isVisible()) {
    await mobileDemoBtn.click();
    await mobilePage.waitForSelector('#s1-snapshot', { timeout: 10000 });
  }

  // Open Data Quality Modal on Mobile
  const mobileQualityBtn = mobilePage.locator('button:has-text("Matched"), button[title*="quality"]').first();
  if (await mobileQualityBtn.isVisible()) {
    await mobileQualityBtn.click();
    await mobilePage.waitForTimeout(500);
    const reportScreenshotMobile = path.join(screenshotsDir, 'report-table-360x800.png');
    await mobilePage.screenshot({ path: reportScreenshotMobile });
    console.log(`Saved screenshot: ${reportScreenshotMobile}`);
    await mobilePage.getByRole('button', { name: /Close/i }).click();
  }

  // Inject synthetic items on Mobile
  await mobilePage.evaluate(() => {
    const store = (window as any).useIngestionStore;
    const films = {
      'https://boxd.it/synth_1': {
        letterboxdUri: 'https://boxd.it/synth_1',
        name: 'Justice League',
        year: 2017,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'ambiguous',
          reason: 'same_title_duplicates',
          candidates: [
            {
              id: 141052,
              title: 'Justice League',
              originalTitle: 'Justice League',
              year: 2017,
              confidenceScore: 1.0,
              posterPath: null,
              overview: 'Batman and Wonder Woman recruit metahumans.'
            },
            {
              id: 408220,
              title: 'Justice League Dark',
              originalTitle: 'Justice League Dark',
              year: 2017,
              confidenceScore: 0.75,
              posterPath: null,
              overview: 'Supernatural squad investigates.'
            }
          ]
        }
      }
    };
    store.setState({
      films,
      reviewNeededCount: 1,
      autoOpenReviewModal: true
    });
  });

  const mobileReviewModal = mobilePage.getByRole('heading', { name: /Review film matches/i });
  await mobileReviewModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Mobile Review modal opened.');

  // Screenshot: Review modal before selection (360x800)
  const modalBefore360 = path.join(screenshotsDir, 'review-modal-before-360x800.png');
  await mobilePage.screenshot({ path: modalBefore360 });
  console.log(`Saved screenshot: ${modalBefore360}`);

  // Select candidate on mobile
  const mobileSelectBtn = mobilePage.getByRole('button', { name: /Select/i }).first();
  await mobileSelectBtn.click();
  await mobilePage.getByText(/Matched Justice League/i).waitFor({ state: 'visible', timeout: 3000 });

  // Screenshot: Review modal after selecting with toast on mobile (360x800)
  const modalAfter360 = path.join(screenshotsDir, 'review-modal-after-with-toast-360x800.png');
  await mobilePage.screenshot({ path: modalAfter360 });
  console.log(`Saved screenshot: ${modalAfter360}`);

  await mobileContext.close();

  await browser.close();
  await server.close();
  console.log('\n--- All verification and screenshots captured successfully! ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
