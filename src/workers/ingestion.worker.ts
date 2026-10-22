/**
 * Ingestion Web Worker
 * Offloads CPU-intensive ZIP decompression and CSV parsing from the main UI thread.
 */

import { extractLetterboxdZip } from '../services/parser/zipParser.ts';
import { processLetterboxdExport } from '../services/parser/csvParser.ts';
import { IngestionState } from '../types/domain.ts';

export type IngestionWorkerMessage =
  | { type: 'PARSE_ZIP'; payload: { buffer: ArrayBuffer } }
  | { type: 'PARSE_CSVS'; payload: { files: Record<string, string> } };

export type IngestionWorkerResponse =
  | { type: 'PROGRESS'; payload: { stage: string; percent: number } }
  | { type: 'SUCCESS'; payload: IngestionState }
  | { type: 'ERROR'; payload: { message: string } };

self.onmessage = (event: MessageEvent<IngestionWorkerMessage>) => {
  const { data } = event;

  try {
    if (data.type === 'PARSE_ZIP') {
      self.postMessage({
        type: 'PROGRESS',
        payload: { stage: 'Decompressing archive...', percent: 20 }
      });

      const uint8 = new Uint8Array(data.payload.buffer);
      const filesMap = extractLetterboxdZip(uint8);

      self.postMessage({
        type: 'PROGRESS',
        payload: { stage: 'Parsing Letterboxd records...', percent: 60 }
      });

      const state = processLetterboxdExport(filesMap);

      self.postMessage({
        type: 'PROGRESS',
        payload: { stage: 'Building domain entities...', percent: 90 }
      });

      self.postMessage({
        type: 'SUCCESS',
        payload: state
      });
    } else if (data.type === 'PARSE_CSVS') {
      self.postMessage({
        type: 'PROGRESS',
        payload: { stage: 'Parsing provided CSV files...', percent: 50 }
      });

      const filesMap = new Map<string, string>(Object.entries(data.payload.files));
      const state = processLetterboxdExport(filesMap);

      self.postMessage({
        type: 'SUCCESS',
        payload: state
      });
    }
  } catch (err: unknown) {
    self.postMessage({
      type: 'ERROR',
      payload: {
        message: err instanceof Error ? err.message : 'Unknown parsing error occurred'
      }
    });
  }
};
