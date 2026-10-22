import React, { useState, useMemo } from 'react';
import { Sparkles, Share2, Link as LinkIcon, Check, ExternalLink } from 'lucide-react';
import { AnalyticsSnapshot } from '../../services/analytics/types.ts';
import { Profile } from '../../types/domain.ts';
import { encodeSharedSnapshot } from '../../services/share/urlShare.ts';
import { tracker } from '../../services/telemetry/tracker.ts';

interface S14ShareSectionProps {
  snapshot?: AnalyticsSnapshot;
  profile?: Profile;
  onOpenShareModal: () => void;
}

export const S14ShareSection: React.FC<S14ShareSectionProps> = ({
  snapshot,
  profile,
  onOpenShareModal
}) => {
  const [linkPreset, setLinkPreset] = useState<'compact' | 'full'>('full');
  const [copied, setCopied] = useState(false);

  // Generate shareable link
  const shareableUrl = useMemo(() => {
    if (!snapshot) return '';
    try {
      const fragment = encodeSharedSnapshot(snapshot, profile, linkPreset);
      const baseUrl = window.location.origin + window.location.pathname;
      return `${baseUrl}${fragment}`;
    } catch {
      return '';
    }
  }, [snapshot, profile, linkPreset]);

  const charLimit = linkPreset === 'compact' ? 2000 : 8000;
  const charCount = shareableUrl.length;
  const isWithinLimit = charCount <= charLimit;

  const handleCopyLink = async () => {
    if (!shareableUrl) return;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      tracker.track({ name: 'share_card_generated', properties: { format: `url_${linkPreset}` } });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <section id="s14-share" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 14 • Social Share & Year in Review
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Share Your Cinema Journey
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Export high-resolution social graphics or share a serverless interactive link compressed directly in the URL fragment.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: PNG Graphic Export */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-7 text-center shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#00e054]/10 border border-[#00e054]/30 text-[#00e054]">
              <Sparkles className="h-6 w-6" />
            </div>

            <h3 className="font-display text-lg font-bold text-white">
              Export Share Graphic
            </h3>

            <p className="mx-auto max-w-sm text-xs text-[#99aabb] leading-relaxed">
              Create 1:1 square posts and 9:16 vertical stories with your headline stats, archetype badge, and favorite genres.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={onOpenShareModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00e054] px-6 py-2.5 font-display font-bold text-sm text-[#14181c] shadow-lg hover:bg-[#00c047] hover:scale-105 active:scale-95 transition-all"
            >
              <Share2 className="h-4 w-4" />
              <span>Generate Share Graphic</span>
            </button>
            <div className="text-[11px] text-[#99aabb]/60">
              100% Client-Side. No images are ever uploaded to any server.
            </div>
          </div>
        </div>

        {/* Card 2: Serverless URL Link Generator */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-7 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[#40bcf4]">
                <LinkIcon className="h-5 w-5" />
                <h3 className="font-display text-lg font-bold text-white">
                  Serverless Share Link
                </h3>
              </div>

              {/* Preset Selector */}
              <div className="flex rounded-lg border border-[#2c3440] bg-[#14181c] p-0.5 text-xs">
                <button
                  onClick={() => setLinkPreset('compact')}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                    linkPreset === 'compact'
                      ? 'bg-[#40bcf4] text-[#14181c]'
                      : 'text-[#99aabb] hover:text-white'
                  }`}
                >
                  Compact (&le;2KB)
                </button>
                <button
                  onClick={() => setLinkPreset('full')}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                    linkPreset === 'full'
                      ? 'bg-[#40bcf4] text-[#14181c]'
                      : 'text-[#99aabb] hover:text-white'
                  }`}
                >
                  Full Report (&le;8KB)
                </button>
              </div>
            </div>

            <p className="text-xs text-[#99aabb] leading-relaxed">
              Your stats are deflated and encoded into the URL fragment (`#v1=...`). Zero database, zero accounts—anyone with the link can view your stats without uploading files.
            </p>

            {/* URL Display Box */}
            <div className="relative rounded-lg border border-[#2c3440] bg-[#14181c] p-2.5">
              <div className="font-mono text-[11px] text-[#ccdde6] truncate select-all pr-12">
                {shareableUrl || 'Generating link...'}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-[#99aabb]">
                <span className={isWithinLimit ? 'text-[#00e054]' : 'text-[#ff8000]'}>
                  {charCount.toLocaleString()} / {charLimit.toLocaleString()} chars
                </span>
                <span className="text-[10px] text-[#99aabb]/60 uppercase tracking-wider">
                  DEFLATE-RAW + Base64URL
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleCopyLink}
              disabled={!shareableUrl}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#40bcf4] px-4 py-2.5 font-display font-bold text-sm text-[#14181c] shadow-lg hover:bg-[#38a9dc] active:scale-95 transition-all disabled:opacity-50"
            >
              {copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Share Link'}</span>
            </button>

            {shareableUrl && (
              <a
                href={shareableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-[#2c3440] bg-[#14181c] p-2.5 text-[#99aabb] hover:border-[#40bcf4] hover:text-white transition-colors"
                title="Preview link in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
