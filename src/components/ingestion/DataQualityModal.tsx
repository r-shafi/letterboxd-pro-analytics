import React, { useState, useEffect } from 'react';
import { Film, ImportReport } from '../../types/domain.ts';
import { storage } from '../../utils/storage.ts';
import { X, Database, Download, Trash2, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface DataQualityModalProps {
  report?: ImportReport;
  films: Record<string, Film>;
  onClose: () => void;
  onOpenReviewMatches: () => void;
  onClearData: () => Promise<void>;
}

export const DataQualityModal: React.FC<DataQualityModalProps> = ({
  report,
  films,
  onClose,
  onOpenReviewMatches,
  onClearData
}) => {
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; quotaFallback: boolean }>({
    usedBytes: 0,
    quotaFallback: false
  });

  useEffect(() => {
    storage.getStorageUsage().then(setStorageUsage);
  }, []);

  const allFilms = Object.values(films);
  const matchedFilms = allFilms.filter((f) => f.match.status === 'confident');
  const ambiguousFilms = allFilms.filter((f) => f.match.status === 'ambiguous');
  const unmatchedFilms = allFilms.filter((f) => f.match.status === 'unmatched');

  // Coverage statistics
  const withRuntime = allFilms.filter((f) => (f.metadata?.runtime || 0) > 0).length;
  const withGenres = allFilms.filter((f) => (f.metadata?.genres.length || 0) > 0).length;
  const withDirectors = allFilms.filter((f) => (f.metadata?.directors.length || 0) > 0).length;
  const withCountries = allFilms.filter((f) => (f.metadata?.productionCountries.length || 0) > 0).length;

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(films, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'letterboxd_pro_analytics_export.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleConfirmClear = async () => {
    if (window.confirm('Are you sure you want to clear all imported film data and cache from your browser?')) {
      await onClearData();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[#2c3440] bg-[#1b2026] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2c3440] px-6 py-4">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-[#00e054]" />
            <h3 className="text-base font-bold text-white">Import & Data Quality Report</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#99aabb] hover:bg-[#2c3440] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Match summary status */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-[#00e054]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Matched</span>
              </div>
              <div className="mt-1 font-display text-xl font-bold text-white">
                {matchedFilms.length}
              </div>
              <div className="text-[10px] text-[#99aabb]">
                {allFilms.length > 0 ? Math.round((matchedFilms.length / allFilms.length) * 100) : 0}%
              </div>
            </div>

            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-[#ff8000]">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Ambiguous</span>
              </div>
              <div className="mt-1 font-display text-xl font-bold text-white">
                {ambiguousFilms.length}
              </div>
              <div className="text-[10px] text-[#99aabb]">
                {allFilms.length > 0 ? Math.round((ambiguousFilms.length / allFilms.length) * 100) : 0}%
              </div>
            </div>

            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-[#99aabb]">
                <span>Unmatched</span>
              </div>
              <div className="mt-1 font-display text-xl font-bold text-white">
                {unmatchedFilms.length}
              </div>
              <div className="text-[10px] text-[#99aabb]">
                {allFilms.length > 0 ? Math.round((unmatchedFilms.length / allFilms.length) * 100) : 0}%
              </div>
            </div>
          </div>

          {(ambiguousFilms.length > 0 || unmatchedFilms.length > 0) && (
            <div className="flex items-center justify-between rounded-lg border border-[#ff8000]/40 bg-[#ff8000]/5 p-3 text-xs">
              <span className="text-[#ccdde6]">
                {ambiguousFilms.length + unmatchedFilms.length} films can be manually reviewed or matched.
              </span>
              <button
                onClick={() => {
                  onClose();
                  onOpenReviewMatches();
                }}
                className="rounded bg-[#ff8000] px-3 py-1.5 font-bold text-[#14181c] hover:bg-[#e67300]"
              >
                Review Matches
              </button>
            </div>
          )}

          {/* Metadata Coverage */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              TMDb Metadata Coverage
            </h4>
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex justify-between text-[#99aabb]">
                <span>Runtimes:</span>
                <span className="font-mono text-white">
                  {withRuntime} / {allFilms.length} ({allFilms.length > 0 ? Math.round((withRuntime / allFilms.length) * 100) : 0}%)
                </span>
              </div>
              <div className="flex justify-between text-[#99aabb]">
                <span>Genres:</span>
                <span className="font-mono text-white">
                  {withGenres} / {allFilms.length} ({allFilms.length > 0 ? Math.round((withGenres / allFilms.length) * 100) : 0}%)
                </span>
              </div>
              <div className="flex justify-between text-[#99aabb]">
                <span>Directors:</span>
                <span className="font-mono text-white">
                  {withDirectors} / {allFilms.length} ({allFilms.length > 0 ? Math.round((withDirectors / allFilms.length) * 100) : 0}%)
                </span>
              </div>
              <div className="flex justify-between text-[#99aabb]">
                <span>Production Countries:</span>
                <span className="font-mono text-white">
                  {withCountries} / {allFilms.length} ({allFilms.length > 0 ? Math.round((withCountries / allFilms.length) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>

          {/* File Row Counts */}
          {report && report.files.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Files Processed
              </h4>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[#2c3440] bg-[#14181c]">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-[#2c3440] bg-[#222831] text-[#99aabb]">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">File</th>
                      <th className="px-3 py-1.5 font-medium">Rows</th>
                      <th className="px-3 py-1.5 font-medium">Accepted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2c3440] text-[#ccdde6]">
                    {report.files.map((file, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-1 font-mono">{file.fileName}</td>
                        <td className="px-3 py-1">{file.rowsFound}</td>
                        <td className="px-3 py-1 text-[#00e054]">{file.rowsAccepted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Storage Usage info */}
          <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3 text-xs text-[#99aabb]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#40bcf4]" />
                <span>Local Storage Used:</span>
              </span>
              <span className="font-mono font-medium text-white">
                {(storageUsage.usedBytes / 1024).toFixed(1)} KB
                {storageUsage.quotaFallback && ' (IndexedDB Spillover Active)'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-[#2c3440] px-6 py-4">
          <div className="flex gap-2">
            <button
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded border border-[#2c3440] bg-[#222831] px-3 py-1.5 text-xs font-medium text-white hover:border-[#00e054]"
            >
              <Download className="h-3.5 w-3.5 text-[#00e054]" />
              Export JSON
            </button>
            <button
              onClick={handleConfirmClear}
              className="inline-flex items-center gap-1.5 rounded border border-[#2c3440] bg-[#222831] px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All Data
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded bg-[#2c3440] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#3d4756]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
