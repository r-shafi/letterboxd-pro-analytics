import React, { useState, useEffect } from 'react';
import { BrandLogo } from '../common/BrandLogo.tsx';
import { CONFIG } from '../../config/env.ts';
import { Star, Settings, ShieldCheck, Database, Download } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenPrivacy?: () => void;
  onOpenQualityModal?: () => void;
  onInstallPwa?: () => void;
  canInstallPwa?: boolean;
  totalFilms?: number;
  matchedCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenPrivacy,
  onOpenQualityModal,
  onInstallPwa,
  canInstallPwa = false,
  totalFilms,
  matchedCount
}) => {
  const [starCount, setStarCount] = useState<number | null>(null);

  useEffect(() => {
    // Silently fetch public GitHub star count with error handling
    const fetchStars = async () => {
      try {
        const repoPath = CONFIG.repoUrl.replace('https://github.com/', '');
        if (!repoPath || repoPath === 'r-shafi/letterboxd-pro-analytics') return;
        const res = await fetch(`https://api.github.com/repos/${repoPath}`);
        if (res.ok) {
          const data = await res.json();
          if (typeof data.stargazers_count === 'number') {
            setStarCount(data.stargazers_count);
          }
        }
      } catch {
        // Fail silently
      }
    };
    fetchStars();
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#2c3440] bg-[#14181c]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div className="flex items-center space-x-3">
          <BrandLogo size={28} />
          <div className="flex flex-col">
            <span className="font-display text-base font-bold tracking-tight text-white sm:text-lg">
              {CONFIG.siteName}
            </span>
          </div>
        </div>

        {/* Data Status & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {totalFilms !== undefined && totalFilms > 0 && onOpenQualityModal && (
            <button
              onClick={onOpenQualityModal}
              className="flex items-center gap-1.5 rounded bg-[#1b2026] px-2.5 py-1 text-xs font-medium text-[#99aabb] hover:bg-[#2c3440] hover:text-white border border-[#2c3440]"
              title="View import and data quality details"
            >
              <Database className="h-3.5 w-3.5 text-[#00e054]" />
              <span className="hidden sm:inline">
                {matchedCount ?? 0}/{totalFilms} Matched
              </span>
              <span className="sm:hidden">
                {matchedCount ?? 0}
              </span>
            </button>
          )}

          {/* Privacy badge */}
          {onOpenPrivacy ? (
            <button
              onClick={onOpenPrivacy}
              className="hidden items-center gap-1 text-xs text-[#99aabb] hover:text-[#00e054] md:flex transition-colors cursor-pointer"
              title="100% In-Browser Computation. View Privacy Guarantee & Disclaimers."
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#00e054]" />
              <span className="text-[11px] font-medium uppercase tracking-wider">Private & Local</span>
            </button>
          ) : (
            <div
              className="hidden items-center gap-1 text-xs text-[#99aabb] md:flex"
              title="100% In-Browser Computation. No film data leaves your device."
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#00e054]" />
              <span className="text-[11px] font-medium uppercase tracking-wider">Private & Local</span>
            </div>
          )}

          {/* PWA Install Button */}
          {canInstallPwa && onInstallPwa && (
            <button
              onClick={onInstallPwa}
              className="flex items-center gap-1.5 rounded border border-[#00e054]/40 bg-[#00e054]/10 px-2.5 py-1 text-xs font-semibold text-[#00e054] hover:bg-[#00e054]/20 transition-all"
              title="Install Web App for offline access"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Settings / BYOK Modal Trigger */}
          <button
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded border border-[#2c3440] bg-[#1b2026] text-[#99aabb] transition-colors hover:border-[#00e054] hover:text-white"
            title="Settings & API Key"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* GitHub Star CTA */}
          <a
            href={CONFIG.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded border border-[#2c3440] bg-[#1b2026] px-2.5 py-1.5 text-xs font-semibold text-[#ccdde6] transition-all hover:border-[#ff8000] hover:bg-[#ff8000]/10 hover:text-white"
            title="Star this repository on GitHub"
          >
            <Star className="h-3.5 w-3.5 text-[#ff8000] fill-[#ff8000]" />
            <span className="hidden sm:inline">Star on GitHub</span>
            <span className="sm:hidden">Star</span>
            {starCount !== null && (
              <span className="ml-1 rounded bg-[#2c3440] px-1.5 py-0.5 text-[10px] font-mono text-white">
                {starCount}
              </span>
            )}
          </a>
        </div>
      </div>
    </header>
  );
};
