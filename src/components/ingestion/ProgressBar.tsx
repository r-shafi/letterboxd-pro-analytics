import React from 'react';
import { Play, Pause, XCircle, Loader2 } from 'lucide-react';
import { IngestionProgress, IngestionPhase } from '../../store/ingestionStore.ts';

interface ProgressBarProps {
  status: IngestionPhase;
  progress: IngestionProgress;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  status,
  progress,
  onPause,
  onResume,
  onCancel
}) => {
  const isPaused = status === 'paused';
  const isMatching = status === 'matching' || status === 'enriching' || status === 'parsing';

  return (
    <div className="mx-auto w-full max-w-3xl rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {isMatching && !isPaused && (
            <Loader2 className="h-5 w-5 animate-spin text-[#00e054]" />
          )}
          {isPaused && <Pause className="h-5 w-5 text-[#ff8000]" />}
          <div>
            <h4 className="text-sm font-semibold text-white">
              {progress.phaseText || 'Processing film data...'}
            </h4>
            <div className="mt-0.5 text-xs text-[#99aabb]">
              {progress.current} of {progress.total} films processed
              {progress.speed > 0 && ` (${progress.speed} films/sec)`}
              {progress.etaSeconds > 0 && ` • ~${progress.etaSeconds}s remaining`}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {isMatching && !isPaused && (
            <button
              onClick={onPause}
              className="inline-flex items-center gap-1 rounded bg-[#2c3440] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3d4756] transition-colors"
              title="Pause ingestion"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>Pause</span>
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResume}
              className="inline-flex items-center gap-1 rounded bg-[#00e054] px-3 py-1.5 text-xs font-bold text-[#14181c] hover:bg-[#00c047] transition-colors"
              title="Resume ingestion"
            >
              <Play className="h-3.5 w-3.5 fill-[#14181c]" />
              <span>Resume</span>
            </button>
          )}

          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1 rounded bg-[#222831] px-3 py-1.5 text-xs font-medium text-[#99aabb] hover:text-red-400 hover:bg-red-950/30 transition-colors"
            title="Cancel import"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      </div>

      {/* Progress Track */}
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#14181c]">
        <div
          className={`h-full transition-all duration-300 ${
            isPaused ? 'bg-[#ff8000]' : 'bg-[#00e054]'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
        />
      </div>
    </div>
  );
};
