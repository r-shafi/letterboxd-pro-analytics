import React, { useState, useEffect } from 'react';
import { Compass, X } from 'lucide-react';

interface SectionItem {
  id: string;
  name: string;
}

const SECTIONS: SectionItem[] = [
  { id: 's1-snapshot', name: 'Snapshot' },
  { id: 's2-identity', name: 'Identity' },
  { id: 's3-volume', name: 'Volume' },
  { id: 's4-ratings', name: 'Ratings' },
  { id: 's5-crowd', name: 'Crowd' },
  { id: 's6-taste', name: 'Taste' },
  { id: 's7-people', name: 'People' },
  { id: 's8-world', name: 'World' },
  { id: 's9-genres', name: 'Genres' },
  { id: 's10-rewatches', name: 'Rewatches' },
  { id: 's11-words', name: 'Words' },
  { id: 's12-watchlist', name: 'Watchlist' },
  { id: 's13-records', name: 'Records' },
  { id: 's14-share', name: 'Share' }
];

export const ScrollSpyNav: React.FC = () => {
  const [activeSection, setActiveSection] = useState('s1-snapshot');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 160;
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(SECTIONS[i].id);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(SECTIONS[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top, behavior: 'smooth' });
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Desktop Sticky Side Rail */}
      <nav
        aria-label="Section navigation"
        className="hidden xl:flex fixed right-6 top-32 z-20 flex-col space-y-1 rounded-xl border border-[#2c3440] bg-[#14181c]/90 p-2 text-xs backdrop-blur-md shadow-xl"
      >
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#99aabb]/60">
          Jump to
        </div>
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => scrollToSection(sec.id)}
            className={`flex items-center space-x-2 rounded-lg px-2.5 py-1 text-left font-medium transition-all ${
              activeSection === sec.id
                ? 'bg-[#00e054]/10 text-[#00e054] font-bold'
                : 'text-[#99aabb] hover:bg-[#1b2026] hover:text-white'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                activeSection === sec.id ? 'bg-[#00e054]' : 'bg-[#2c3440]'
              }`}
            />
            <span>{sec.name}</span>
          </button>
        ))}
      </nav>

      {/* Mobile Floating Action Button */}
      <div className="xl:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00e054] text-[#14181c] shadow-2xl hover:scale-105 active:scale-95 transition-all"
          title="Jump to Section"
          aria-label="Jump to Section"
        >
          <Compass className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile Sheet Dialog */}
      {isMobileOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#2c3440] bg-[#1b2026] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2c3440] pb-3 mb-3">
              <h3 className="font-display text-sm font-bold text-white">Jump to Section</h3>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="rounded p-1 text-[#99aabb] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                    activeSection === sec.id
                      ? 'bg-[#00e054] text-[#14181c] font-bold'
                      : 'bg-[#14181c] text-[#ccdde6] hover:bg-[#2c3440]'
                  }`}
                >
                  {sec.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
