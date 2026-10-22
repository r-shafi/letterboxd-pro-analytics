/**
 * Ingestion Service
 * Dispatches parsing work to the Ingestion Web Worker with seamless fallback
 * to main-thread processing when Workers are unavailable or in test environments.
 */

import { IngestionState } from '../../types/domain.ts';
import { extractLetterboxdZip } from './zipParser.ts';
import { processLetterboxdExport } from './csvParser.ts';
import { IngestionWorkerMessage, IngestionWorkerResponse } from '../../workers/ingestion.worker.ts';

export type IngestionProgressCallback = (stage: string, percent: number) => void;

export async function parseLetterboxdZip(
  file: File | ArrayBuffer,
  onProgress?: IngestionProgressCallback
): Promise<IngestionState> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file;

  // Check if Web Worker can be instantiated in current environment
  if (typeof Worker !== 'undefined' && typeof window !== 'undefined' && !window.location.href.includes('vitest')) {
    try {
      return await new Promise<IngestionState>((resolve, reject) => {
        const worker = new Worker(
          new URL('../../workers/ingestion.worker.ts', import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = (e: MessageEvent<IngestionWorkerResponse>) => {
          const res = e.data;
          if (res.type === 'PROGRESS') {
            onProgress?.(res.payload.stage, res.payload.percent);
          } else if (res.type === 'SUCCESS') {
            worker.terminate();
            resolve(res.payload);
          } else if (res.type === 'ERROR') {
            worker.terminate();
            reject(new Error(res.payload.message));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          reject(err);
        };

        const msg: IngestionWorkerMessage = {
          type: 'PARSE_ZIP',
          payload: { buffer }
        };
        worker.postMessage(msg, [buffer]);
      });
    } catch {
      // Fall through to synchronous processing if worker creation fails
    }
  }

  // Synchronous fallback
  onProgress?.('Decompressing archive...', 20);
  const uint8 = new Uint8Array(buffer);
  const filesMap = extractLetterboxdZip(uint8);

  onProgress?.('Parsing Letterboxd records...', 60);
  const state = processLetterboxdExport(filesMap);

  onProgress?.('Building domain entities...', 95);
  return state;
}

export async function parseLetterboxdCsvFiles(
  files: Record<string, string>,
  onProgress?: IngestionProgressCallback
): Promise<IngestionState> {
  onProgress?.('Parsing provided CSV files...', 50);
  const filesMap = new Map<string, string>(Object.entries(files));
  return processLetterboxdExport(filesMap);
}
