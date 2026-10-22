import React, { useRef, useState } from 'react';
import { AnalyticsSnapshot } from '../../services/analytics/types.ts';
import { toPng } from 'html-to-image';
import { CONFIG } from '../../config/env.ts';
import { BrandLogo } from '../common/BrandLogo.tsx';
import { X, Download, Share2, Sparkles, Link as LinkIcon, Check } from 'lucide-react';
import { formatWatchDuration } from '../../utils/date.ts';
import { tracker } from '../../services/telemetry/tracker.ts';
import { Profile } from '../../types/domain.ts';
import { encodeSharedSnapshot } from '../../services/share/urlShare.ts';

interface ShareCardModalProps {
  snapshot: AnalyticsSnapshot;
  profile?: Profile;
  onClose: () => void;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({ snapshot, profile, onClose }) => {
  const [aspectRatio, setAspectRatio] = useState<'square' | 'story'>('square');
  const [isExporting, setIsExporting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const duration = formatWatchDuration(snapshot.s1Snapshot.totalRuntimeMinutes);
  const topDirector = snapshot.s7People.directors[0];
  const topActor = snapshot.s7People.actors[0];
  const topGenre = snapshot.s9Genres.genres[0];
  const badge = snapshot.s2Identity.archetypes[0];

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2
      });

      const link = document.createElement('a');
      link.download = `letterboxd_analytics_${snapshot.filter.selectedYear || 'all_time'}_${aspectRatio}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Ignore
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current || !navigator.share) {
      handleDownload();
      return;
    }

    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      tracker.track({ name: 'share_card_generated', properties: { format: aspectRatio } });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'letterboxd_analytics_share.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${CONFIG.siteName} Stats`,
          text: `Here are my Letterboxd stats generated with ${CONFIG.siteName}!`,
          files: [file]
        });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const fragment = encodeSharedSnapshot(snapshot, profile, 'compact');
      const url = `${window.location.origin}${window.location.pathname}${fragment}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      tracker.track({ name: 'share_card_generated', properties: { format: 'url_compact' } });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="flex max-h-[95vh] w-full max-w-xl flex-col rounded-xl border border-[#2c3440] bg-[#1b2026] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2c3440] px-6 py-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-[#00e054]" />
            <h3 className="text-base font-bold text-white">Generate Social Share Card</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#99aabb] hover:bg-[#2c3440] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Aspect Ratio Switch */}
        <div className="flex items-center justify-center border-b border-[#2c3440] bg-[#14181c] py-2 gap-2 text-xs">
          <button
            onClick={() => setAspectRatio('square')}
            className={`rounded-lg px-4 py-1.5 font-bold transition-colors ${
              aspectRatio === 'square'
                ? 'bg-[#00e054] text-[#14181c]'
                : 'text-[#99aabb] hover:text-white'
            }`}
          >
            Square 1:1 (Post)
          </button>
          <button
            onClick={() => setAspectRatio('story')}
            className={`rounded-lg px-4 py-1.5 font-bold transition-colors ${
              aspectRatio === 'story'
                ? 'bg-[#00e054] text-[#14181c]'
                : 'text-[#99aabb] hover:text-white'
            }`}
          >
            Story 9:16 (Story)
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-black/40">
          <div
            ref={cardRef}
            className={`flex flex-col justify-between border border-[#2c3440] bg-[#14181c] p-6 shadow-2xl relative ${
              aspectRatio === 'square'
                ? 'w-[360px] h-[360px]'
                : 'w-[320px] h-[568px]'
            }`}
          >
            {/* Top Brand Bar */}
            <div className="flex items-center justify-between border-b border-[#2c3440] pb-3">
              <div className="flex items-center space-x-2">
                <BrandLogo size={22} />
                <span className="font-display text-sm font-bold text-white tracking-tight">
                  {CONFIG.siteName}
                </span>
              </div>
              <span className="rounded bg-[#00e054]/10 px-2 py-0.5 text-[10px] font-bold text-[#00e054] border border-[#00e054]/20">
                {snapshot.filter.selectedYear || 'All-Time Report'}
              </span>
            </div>

            {/* Core Stats Grid */}
            <div className="my-auto space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg border border-[#2c3440] bg-[#1b2026] p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-[#99aabb]">Films Watched</div>
                  <div className="mt-0.5 font-display text-2xl font-black text-white">
                    {snapshot.s1Snapshot.totalFilms}
                  </div>
                </div>

                <div className="rounded-lg border border-[#2c3440] bg-[#1b2026] p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-[#99aabb]">Watch Time</div>
                  <div className="mt-0.5 font-display text-2xl font-black text-[#00e054]">
                    {duration.compact}
                  </div>
                </div>
              </div>

              {/* Highlights */}
              <div className="rounded-lg border border-[#2c3440] bg-[#1b2026] p-3 space-y-1.5 text-xs">
                {badge && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#99aabb]">Archetype:</span>
                    <span className="font-bold text-[#ff8000]">{badge.name}</span>
                  </div>
                )}
                {topDirector && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#99aabb]">Top Director:</span>
                    <span className="font-semibold text-white">{topDirector.person.name} ({topDirector.count})</span>
                  </div>
                )}
                {topActor && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#99aabb]">Top Actor:</span>
                    <span className="font-semibold text-white">{topActor.person.name} ({topActor.count})</span>
                  </div>
                )}
                {topGenre && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#99aabb]">Favorite Genre:</span>
                    <span className="font-semibold text-white">{topGenre.name} ({topGenre.count})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with mandatory TMDb attribution */}
            <div className="flex items-center justify-between border-t border-[#2c3440] pt-3 text-[9px] text-[#99aabb]">
              <div className="flex items-center space-x-1">
                <span className="font-bold text-[#00e054]">TMDb</span>
                <span>Powered</span>
              </div>
              <span>letterboxd-pro-analytics</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between border-t border-[#2c3440] px-6 py-4">
          <div className="text-xs text-[#99aabb]">Saved 100% locally to your device</div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2c3440] bg-[#14181c] px-3 py-2 text-xs font-medium text-[#40bcf4] hover:border-[#40bcf4]"
              title="Copy compressed stats link"
            >
              {copiedLink ? <Check className="h-4 w-4 text-[#00e054]" /> : <LinkIcon className="h-4 w-4" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00e054] px-4 py-2 text-xs font-bold text-[#14181c] hover:bg-[#00c047] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? 'Generating...' : 'Download PNG'}</span>
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleShare}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2c3440] bg-[#222831] px-4 py-2 text-xs font-medium text-white hover:border-[#40bcf4]"
              >
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
