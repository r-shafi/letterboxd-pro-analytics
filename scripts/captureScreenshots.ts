import { chromium } from '@playwright/test';
import { preview } from 'vite';
import path from 'path';
import fs from 'fs';

async function main() {
  console.log('Starting Vite preview server...');
  const server = await preview({
    preview: {
      port: 4173,
      host: '127.0.0.1'
    }
  });

  const outDir = path.resolve(process.cwd(), 'docs/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch();

  const viewports = [
    { name: 'desktop-1440x900', width: 1440, height: 900 },
    { name: 'tablet-landscape-1024x768', width: 1024, height: 768 },
    { name: 'tablet-portrait-768x1024', width: 768, height: 1024 },
    { name: 'mobile-iphone12-390x844', width: 390, height: 844 },
    { name: 'mobile-android-360x800', width: 360, height: 800 }
  ];

  for (const vp of viewports) {
    console.log(`Capturing ${vp.name} (${vp.width}x${vp.height})...`);
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height }
    });

    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });

    // Click demo button to hydrate rich dataset
    const demoBtn = page.getByRole('button', { name: /Try Demo Data/i });
    if (await demoBtn.isVisible()) {
      await demoBtn.click();
      // Wait for narrative sections to appear
      await page.waitForSelector('#s1-snapshot', { timeout: 10000 });
      await page.waitForTimeout(1000); // let motion animations settle
    }

    const outPath = path.join(outDir, `${vp.name}.png`);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`Saved screenshot: ${outPath}`);
    await page.close();
  }

  await browser.close();
  await server.close();
  console.log('All responsive screenshots captured successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
