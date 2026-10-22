import React from 'react';
import { CONFIG } from '../../config/env.ts';
import { Star, Bug, GitPullRequest, Shield, FileText } from 'lucide-react';

interface FooterProps {
  onOpenPrivacy: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenPrivacy }) => {
  // Construct email at runtime to prevent automated scraping
  const handleEmailClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const user = CONFIG.authorEmail.split('@')[0] || 'shafi';
    const domain = CONFIG.authorEmail.split('@')[1] || 'example.com';
    window.location.href = `mailto:${user}@${domain}?subject=Letterboxd%20Pro%20Analytics`;
  };

  return (
    <footer className="w-full border-t border-[#2c3440] bg-[#14181c] py-12 text-sm text-[#99aabb]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Call to Action row */}
        <div className="mb-8 rounded-lg border border-[#2c3440] bg-[#1b2026] p-6 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
          <div>
            <h3 className="font-display text-base font-bold text-white">
              Enjoying {CONFIG.siteName}?
            </h3>
            <p className="mt-1 text-xs text-[#99aabb]">
              This project is 100% free and open-source under the MIT License. Your support helps keep it maintained.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-3 sm:mt-0">
            <a
              href={CONFIG.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-[#2c3440] bg-[#222831] px-3 py-1.5 text-xs font-medium text-white hover:border-[#ff8000] hover:text-[#ff8000]"
            >
              <Star className="h-3.5 w-3.5 text-[#ff8000] fill-[#ff8000]" />
              Star Repository
            </a>
            <a
              href={`${CONFIG.repoUrl}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-[#2c3440] bg-[#222831] px-3 py-1.5 text-xs font-medium text-white hover:border-[#40bcf4] hover:text-[#40bcf4]"
            >
              <Bug className="h-3.5 w-3.5 text-[#40bcf4]" />
              Report Bug
            </a>
            <a
              href={`${CONFIG.repoUrl}/pulls`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-[#2c3440] bg-[#222831] px-3 py-1.5 text-xs font-medium text-white hover:border-[#00e054] hover:text-[#00e054]"
            >
              <GitPullRequest className="h-3.5 w-3.5 text-[#00e054]" />
              Contribute
            </a>
          </div>
        </div>

        {/* TMDb Attribution & Disclaimers */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Column 1: TMDb Attribution */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <svg className="h-4 w-auto fill-[#00e054]" viewBox="0 0 184 16" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="13" fill="#00e054" fontFamily="sans-serif" fontSize="14" fontWeight="bold">TMDB</text>
              </svg>
              <span className="text-xs font-semibold text-white">The Movie Database</span>
            </div>
            <p className="text-xs leading-relaxed text-[#99aabb]">
              This product uses the TMDb API but is not endorsed or certified by TMDb. Film metadata, cast, crew, and artwork are provided courtesy of TMDb.
            </p>
          </div>

          {/* Column 2: Legal Disclaimers & Non-Affiliation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Disclaimers</h4>
            <p className="text-xs leading-relaxed text-[#99aabb]">
              Not affiliated with, associated with, authorized by, endorsed by, or in any way officially connected with Letterboxd Limited or any of its subsidiaries or affiliates.
            </p>
          </div>

          {/* Column 3: Author & Meta Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Project & Privacy</h4>
            <p className="text-xs text-[#99aabb]">
              Crafted by{' '}
              <a
                href={CONFIG.authorPortfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#00e054] hover:underline"
              >
                {CONFIG.authorName}
              </a>
              {' • '}
              <button
                onClick={handleEmailClick}
                className="font-medium text-[#40bcf4] hover:underline"
              >
                Contact
              </button>
            </p>
            <div className="flex items-center gap-4 text-xs">
              <button
                onClick={onOpenPrivacy}
                className="inline-flex items-center gap-1 text-[#99aabb] hover:text-white"
              >
                <Shield className="h-3 w-3 text-[#00e054]" />
                Privacy Policy
              </button>
              <a
                href={`${CONFIG.repoUrl}/blob/main/LICENSE`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#99aabb] hover:text-white"
              >
                <FileText className="h-3 w-3 text-[#99aabb]" />
                MIT License
              </a>
              <span className="text-[11px] text-[#99aabb]/60">v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
