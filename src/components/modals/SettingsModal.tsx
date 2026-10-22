import React, { useState } from 'react';
import { tmdbClient } from '../../services/tmdb/client.ts';
import { tracker } from '../../services/telemetry/tracker.ts';
import { X, Key, Check, AlertCircle, Trash2, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [usingUserKey, setUsingUserKey] = useState(tmdbClient.isUsingUserKey());

  const handleValidateAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKeyInput.trim();
    if (!key) return;

    setIsValidating(true);
    setValidationStatus('idle');

    const isValid = await tmdbClient.validateKey(key);
    setIsValidating(false);

    if (isValid) {
      setValidationStatus('valid');
      tmdbClient.setApiKeyOrToken(key);
      tracker.track({ name: 'byok_enabled' });
      setUsingUserKey(true);
      setApiKeyInput('');
    } else {
      setValidationStatus('invalid');
    }
  };

  const handleRemoveKey = () => {
    tmdbClient.setApiKeyOrToken('');
    setUsingUserKey(false);
    setValidationStatus('idle');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-[#2c3440] bg-[#1b2026] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2c3440] px-6 py-4">
          <div className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-[#00e054]" />
            <h3 className="text-base font-bold text-white">Settings & TMDb API Key</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#99aabb] hover:bg-[#2c3440] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Key Status */}
          <div className="flex items-center justify-between rounded-lg border border-[#2c3440] bg-[#14181c] p-3">
            <div>
              <div className="font-semibold text-white">Active Key Status</div>
              <div className="mt-0.5 text-[#99aabb]">
                {usingUserKey ? 'Using your custom BYOK key' : 'Using preconfigured fallback key'}
              </div>
            </div>
            {usingUserKey ? (
              <span className="rounded bg-[#00e054]/10 px-2 py-1 text-[11px] font-bold text-[#00e054] border border-[#00e054]/20">
                Custom BYOK Active
              </span>
            ) : (
              <span className="rounded bg-[#2c3440] px-2 py-1 text-[11px] text-[#99aabb]">
                Fallback Active
              </span>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleValidateAndSave} className="space-y-3">
            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3 text-xs leading-relaxed text-[#ccdde6]">
              <strong>Bring Your Own Key (Optional):</strong> Add your free TMDb API key for higher rate limits and faster enrichment. Stored locally only in your browser.
            </div>

            <label className="block font-semibold text-white">
              Enter TMDb API Key (v3) or Read Access Token (v4)
            </label>

            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setValidationStatus('idle');
                }}
                placeholder="Paste TMDb Key or Token here..."
                className="flex-1 rounded-lg border border-[#2c3440] bg-[#14181c] px-3 py-2 text-xs text-white placeholder-[#99aabb]/50 focus:border-[#00e054] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isValidating || !apiKeyInput.trim()}
                className="rounded-lg bg-[#00e054] px-4 py-2 font-bold text-[#14181c] hover:bg-[#00c047] disabled:opacity-50 transition-colors"
              >
                {isValidating ? 'Validating...' : 'Validate & Save'}
              </button>
            </div>

            {validationStatus === 'valid' && (
              <div className="flex items-center gap-1.5 text-[#00e054] font-medium">
                <Check className="h-4 w-4" />
                <span>API Key verified and activated successfully!</span>
              </div>
            )}

            {validationStatus === 'invalid' && (
              <div className="flex items-center gap-1.5 text-red-400 font-medium">
                <AlertCircle className="h-4 w-4" />
                <span>Validation failed. Please verify your TMDb key or token.</span>
              </div>
            )}
          </form>

          {usingUserKey && (
            <div className="pt-2">
              <button
                onClick={handleRemoveKey}
                className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove custom key and revert to fallback</span>
              </button>
            </div>
          )}

          {/* TMDb Account link */}
          <div className="border-t border-[#2c3440] pt-4 text-[11px] text-[#99aabb]">
            Don&apos;t have a TMDb key? Get one for free at{' '}
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[#00e054] hover:underline"
            >
              themoviedb.org/settings/api
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[#2c3440] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-[#2c3440] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3d4756]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
