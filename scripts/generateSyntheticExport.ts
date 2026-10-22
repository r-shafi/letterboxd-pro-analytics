#!/usr/bin/env node
/**
 * CLI script to generate synthetic Letterboxd exports (20, 1000, 5000 films)
 */

import fs from 'fs';
import path from 'path';
import { generateSyntheticZip } from '../src/services/synthetic/generator.ts';

const outDir = path.resolve(process.cwd(), 'fixtures');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

[20, 1000, 5000].forEach((count) => {
  console.log(`Generating synthetic export with ${count} films...`);
  const zipBuffer = generateSyntheticZip({ filmCount: count });
  const outPath = path.join(outDir, `synthetic-${count}.zip`);
  fs.writeFileSync(outPath, zipBuffer);
  console.log(`Saved ${outPath} (${(zipBuffer.byteLength / 1024).toFixed(1)} KB)`);
});

console.log('Synthetic export generation complete.');
