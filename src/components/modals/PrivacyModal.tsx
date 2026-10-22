import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Lock, EyeOff, Server, Database, Check } from 'lucide-react';
import { tracker } from '../../services/telemetry/tracker.ts';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  const [optOut, setOptOut] = useState<boolean>(() => {
    try {
      return localStorage.getItem('analytics:optout') === 'true';
    } catch {
      return false;
    }
  });

  const [dntActive, setDntActive] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDnt =
        window.navigator?.doNotTrack === '1' ||
        (window as unknown as { doNotTrack?: string }).doNotTrack === '1';
      setDntActive(isDnt);
    }
  }, []);

  if (!isOpen) return null;

  const handleToggleOptOut = () => {
    const next = !optOut;
    setOptOut(next);
    tracker.setOptOut(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#2c3440] bg-[#14181c] p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2c3440] pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00e054]/10 text-[#00e054]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-white">Privacy & Legal Disclaimers</h2>
              <p className="text-xs text-[#99aabb]">Zero-knowledge architecture & local-first security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#99aabb] hover:bg-[#2c3440] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Core Principles */}
        <div className="space-y-4 text-xs leading-relaxed text-[#ccdde6]">
          <div className="flex items-start space-x-3 p-3.5 rounded-xl border border-[#2c3440] bg-[#1b2026]">
            <Server className="h-5 w-5 text-[#00e054] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm">100% Client-Side Processing</div>
              <p className="mt-1 text-[#99aabb]">
                Your exported Letterboxd archive is unzipped and parsed entirely inside your browser using Web Workers. Your personal export files are never uploaded to any backend server.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3.5 rounded-xl border border-[#2c3440] bg-[#1b2026]">
            <Database className="h-5 w-5 text-[#40bcf4] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm">Local Device Persistence</div>
              <p className="mt-1 text-[#99aabb]">
                Extracted records, TMDb metadata, and statistical snapshots are persisted locally on your device using LZ-String compression and IndexedDB. You can purge this data at any time in Settings.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3.5 rounded-xl border border-[#2c3440] bg-[#1b2026]">
            <EyeOff className="h-5 w-5 text-[#ff8000] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm">Automatic Privacy Scrubbing</div>
              <p className="mt-1 text-[#99aabb]">
                Any sensitive personal profile fields present in your export (such as Email Address, Family Name, Location, Pronouns, and Website) are immediately sanitized and stripped upon import.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3.5 rounded-xl border border-[#2c3440] bg-[#1b2026]">
            <Lock className="h-5 w-5 text-[#00e054] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm">TMDb Enrichment Only</div>
              <p className="mt-1 text-[#99aabb]">
                The only external network requests made are lookups to the TMDb API to match film titles and fetch release metadata (genres, cast, crew, runtime, posters). No user-identifying info is sent.
              </p>
            </div>
          </div>
        </div>

        {/* Telemetry Control */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">Usage Analytics & Telemetry</div>
              <p className="text-xs text-[#99aabb] mt-0.5">
                {dntActive
                  ? 'Your browser has Do Not Track enabled. Telemetry is automatically disabled.'
                  : 'Anonymous operational event telemetry (e.g. pageviews, bucketed library sizes).'}
              </p>
            </div>
            {!dntActive && (
              <button
                onClick={handleToggleOptOut}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  optOut ? 'bg-[#2c3440]' : 'bg-[#00e054]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    optOut ? 'translate-x-0' : 'translate-x-5'
                  }`}
                />
              </button>
            )}
          </div>
          {optOut && !dntActive && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#ff8000]">
              <Check className="h-3.5 w-3.5" />
              <span>You have opted out of anonymous usage analytics.</span>
            </div>
          )}
        </div>

        {/* Legal Disclaimers */}
        <div className="rounded-xl border border-[#2c3440] bg-[#14181c] p-4 text-[11px] text-[#99aabb] space-y-2">
          <div className="font-bold uppercase tracking-wider text-white">Legal Disclaimers</div>
          <p>
            &bull; <strong>TMDb:</strong> This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
          <p>
            &bull; <strong>Letterboxd:</strong> Not affiliated with, maintained, or endorsed by Letterboxd Limited. All Letterboxd trademarks and logos belong to Letterboxd Limited.
          </p>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-lg bg-[#00e054] px-5 py-2 text-xs font-bold text-[#14181c] shadow hover:bg-[#00c047] transition-all"
          >
            Close & Understand
          </button>
        </div>
      </div>
    </div>
  );
};
