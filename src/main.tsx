import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Header } from './components/layout/Header.tsx';
import { Footer } from './components/layout/Footer.tsx';
import './index.css';

export const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#14181c] text-[#ccdde6]">
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        totalFilms={0}
        matchedCount={0}
      />

      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-8 text-center shadow-2xl">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Letterboxd Pro Analytics
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-[#99aabb]">
              Client-side, privacy-first deep analytics for your official Letterboxd data export.
            </p>
          </div>
        </section>
      </main>

      <Footer onOpenPrivacy={() => setIsPrivacyOpen(true)} />

      {/* Basic Modals for Phase 1 */}
      {isSettingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white">Settings & API Keys</h2>
            <p className="mt-2 text-xs text-[#99aabb]">
              TMDb API configuration will be wired in Phase 2.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="rounded bg-[#2c3440] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3d4756]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isPrivacyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white">Privacy Guarantee</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#99aabb]">
              Your film exports are parsed and stored strictly on your device. Only movie titles and years are queried to TMDb for metadata.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsPrivacyOpen(false)}
                className="rounded bg-[#00e054] px-4 py-2 text-xs font-bold text-[#14181c] hover:bg-[#00c047]"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
