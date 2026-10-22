import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function generateIcons() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const svgContent = fs.readFileSync(path.resolve('public/favicon.svg'), 'utf-8');
  
  const sizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-512-maskable.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 }
  ];

  for (const { name, size } of sizes) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { width: ${size}px; height: ${size}px; background: #14181c; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            svg { width: ${size}px; height: ${size}px; }
          </style>
        </head>
        <body>
          ${svgContent}
        </body>
      </html>
    `;

    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html);
    const outPath = path.resolve('public', name);
    await page.screenshot({ path: outPath, omitBackground: false });
    console.log(`Generated: ${outPath} (${size}x${size})`);
  }

  await browser.close();
}

generateIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
