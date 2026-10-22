import React, { useState } from 'react';
import { Film } from '../../types/domain.ts';
import { X, Star, ExternalLink, ArrowUpDown } from 'lucide-react';
import { CONFIG } from '../../config/env.ts';

interface FilmDrawerProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  filmKeys: string[];
  filmsRecord: Record<string, Film>;
  onClose: () => void;
}

export const FilmDrawer: React.FC<FilmDrawerProps> = ({
  isOpen,
  title,
  subtitle,
  filmKeys,
  filmsRecord,
  onClose
}) => {
  const [sortBy, setSortBy] = useState<'rating' | 'year' | 'title'>('rating');

  if (!isOpen) return null;

  const filmList = filmKeys
    .map((k) => filmsRecord[k])
    .filter((f): f is Film => Boolean(f));

  const sortedFilms = [...filmList].sort((a, b) => {
    if (sortBy === 'rating') {
      const rA = a.rating || 0;
      const rB = b.rating || 0;
      return rB - rA;
    }
    if (sortBy === 'year') {
      return (b.year || 0) - (a.year || 0);
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm transition-opacity">
      <div className="flex h-full w-full max-w-xl flex-col bg-[#14181c] border-l border-[#2c3440] shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2c3440] bg-[#1b2026] px-6 py-4">
          <div>
            <h3 className="font-display text-base font-bold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-[#99aabb] mt-0.5">{subtitle}</p>}
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-[#99aabb] hover:bg-[#2c3440] hover:text-white transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar: Count & Sort */}
        <div className="flex items-center justify-between border-b border-[#2c3440] bg-[#1b2026]/50 px-6 py-2.5 text-xs text-[#99aabb]">
          <div>
            Showing <span className="font-mono font-bold text-white">{filmList.length}</span> films
          </div>

          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3 w-3 text-[#00e054]" />
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'rating' | 'year' | 'title')}
              className="rounded bg-[#14181c] border border-[#2c3440] px-2 py-0.5 text-xs text-white focus:outline-none"
            >
              <option value="rating">Rating (Highest)</option>
              <option value="year">Release Year (Newest)</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Grid list of films */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {sortedFilms.map((film) => (
              <div
                key={film.letterboxdUri}
                className="film-poster-card flex flex-col group"
              >
                <div className="relative aspect-[2/3] w-full bg-[#1b2026] overflow-hidden">
                  {film.metadata?.posterPath ? (
                    <img
                      src={`${CONFIG.tmdbImageBase}/w342${film.metadata.posterPath}`}
                      alt={film.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center bg-[#222831]">
                      <span className="text-xs font-semibold text-[#ccdde6] line-clamp-2">
                        {film.name}
                      </span>
                      {film.year && (
                        <span className="text-[10px] text-[#99aabb] mt-1">{film.year}</span>
                      )}
                    </div>
                  )}

                  {/* Rating badge overlay */}
                  {film.rating !== undefined && (
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-[#00e054] backdrop-blur-sm">
                      <Star className="h-3 w-3 fill-[#00e054]" />
                      <span>{film.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="p-2.5">
                  <div className="font-semibold text-xs text-white truncate" title={film.name}>
                    {film.name}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#99aabb]">
                    <span>{film.year || 'Unknown'}</span>
                    {film.metadata?.runtime ? (
                      <span>{film.metadata.runtime}m</span>
                    ) : null}
                  </div>

                  {film.metadata?.id && (
                    <a
                      href={`https://www.themoviedb.org/movie/${film.metadata.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[10px] text-[#40bcf4] hover:underline"
                    >
                      <span>TMDb</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
