import React from 'react';
import { S1Snapshot } from '../../services/analytics/types.ts';
import { Profile, Film } from '../../types/domain.ts';
import { formatWatchDuration } from '../../utils/date.ts';
import { formatRating } from '../../services/analytics/statistical.ts';
import { CONFIG } from '../../config/env.ts';
import { Film as FilmIcon, Clock, Star, Heart, Repeat, MessageSquare, Globe, User, Compass } from 'lucide-react';

interface S1SnapshotSectionProps {
  snapshot: S1Snapshot;
  profile?: Profile;
  filmsRecord: Record<string, Film>;
  onSelectFilm: (filmKey: string) => void;
}

export const S1SnapshotSection: React.FC<S1SnapshotSectionProps> = ({
  snapshot,
  profile,
  filmsRecord,
  onSelectFilm
}) => {
  const duration = formatWatchDuration(snapshot.totalRuntimeMinutes);

  // Resolve favorite films locally from profile.favoriteFilmUris
  const favoriteFilms = (profile?.favoriteFilmUris || [])
    .map((uri) => filmsRecord[uri])
    .filter((f): f is Film => Boolean(f));

  return (
    <section id="s1-snapshot" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 01 • Snapshot
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          At a Glance
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Direct and derived headline metrics across your active Letterboxd film history.
        </p>
      </div>

      {/* Profile Card if present */}
      {profile && (
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start space-x-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#00e054]/10 border border-[#00e054]/30 text-[#00e054]">
                <User className="h-7 w-7" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  {profile.givenName ? `${profile.givenName} (@${profile.username})` : `@${profile.username}`}
                </h3>
                {profile.bio && (
                  <p className="mt-1 text-xs text-[#ccdde6] max-w-xl leading-relaxed italic">
                    &ldquo;{profile.bio}&rdquo;
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#99aabb]">
                  {profile.dateJoined && (
                    <span>Member since {profile.dateJoined}</span>
                  )}
                  <span>•</span>
                  <span>{snapshot.yearsSpan} years of history</span>
                </div>
              </div>
            </div>

            {/* Favorite films 4-poster row */}
            {favoriteFilms.length > 0 && (
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#99aabb] mb-2">
                  Favorites (Resolved Locally)
                </span>
                <div className="flex gap-2">
                  {favoriteFilms.map((film) => (
                    <button
                      key={film.letterboxdUri}
                      onClick={() => onSelectFilm(film.letterboxdUri)}
                      className="group relative h-20 w-14 rounded overflow-hidden border border-[#2c3440] hover:border-[#00e054] transition-all bg-[#14181c]"
                      title={film.name}
                    >
                      {film.metadata?.posterPath ? (
                        <img
                          src={`${CONFIG.tmdbImageBase}/w185${film.metadata.posterPath}`}
                          alt={film.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-1 text-[8px] text-[#99aabb] text-center">
                          {film.name}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bento Stat Tiles Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Films Watched */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Films Watched</span>
            <FilmIcon className="h-4 w-4 text-[#00e054]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-white">
            {snapshot.totalFilms}
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            {snapshot.totalViewings} total viewings
          </div>
        </div>

        {/* Watch Time */}
        <div
          className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow"
          title={`Full breakdown: ${duration.detailed} (assuming 1 month = 30 days)`}
        >
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Watch Time</span>
            <Clock className="h-4 w-4 text-[#00e054]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-[#00e054]">
            {duration.compact}
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb] truncate">
            {snapshot.runtimeCoveragePercent === 100
              ? duration.detailed
              : snapshot.runtimeCoveragePercent === 0
                ? 'Loading movie runtimes...'
                : `${duration.detailed} (${snapshot.runtimeCoveragePercent}% runtime coverage)`}
          </div>
        </div>

        {/* Average Rating */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Average Rating</span>
            <Star className="h-4 w-4 text-[#00e054] fill-[#00e054]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-white">
            {formatRating(snapshot.averageRating, 2)}
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            {snapshot.ratedFilmsCount} rated ({snapshot.ratingCoveragePercent}%)
          </div>
        </div>

        {/* Liked Films */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Liked Films</span>
            <Heart className="h-4 w-4 text-[#ff8000] fill-[#ff8000]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-white">
            {snapshot.likedFilmsCount}
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            {snapshot.totalFilms > 0 ? Math.round((snapshot.likedFilmsCount / snapshot.totalFilms) * 100) : 0}% liked share
          </div>
        </div>

        {/* Reviews */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Reviews Written</span>
            <MessageSquare className="h-4 w-4 text-[#40bcf4]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-white">
            {snapshot.reviewsCount}
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            Logged thoughts & reflections
          </div>
        </div>

        {/* Rewatches */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Rewatches</span>
            <Repeat className="h-4 w-4 text-[#00e054]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-white">
            {snapshot.rewatchesCount}
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            {snapshot.totalViewings > 0 ? Math.round((snapshot.rewatchesCount / snapshot.totalViewings) * 100) : 0}% rewatch rate
          </div>
        </div>

        {/* Countries */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Countries</span>
            <Globe className="h-4 w-4 text-[#40bcf4]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-white">
            {snapshot.uniqueCountriesCount}
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            {snapshot.uniqueLanguagesCount} languages
          </div>
        </div>

        {/* Directors */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Directors</span>
            <Compass className="h-4 w-4 text-[#ff8000]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-white">
            {snapshot.uniqueDirectorsCount}
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            Unique filmmakers discovered
          </div>
        </div>
      </div>
    </section>
  );
};
