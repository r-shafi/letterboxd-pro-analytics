export interface AppConfig {
  siteName: string;
  repoUrl: string;
  authorName: string;
  authorPortfolioUrl: string;
  authorEmail: string;
  tmdbFallbackKey: string;
  tmdbApiBase: string;
  tmdbImageBase: string;
  analyticsProvider: string;
  analyticsDomain: string;
  analyticsApiHost: string;
}

export const CONFIG: AppConfig = {
  siteName: import.meta.env.VITE_SITE_NAME || 'Letterboxd Pro Analytics',
  repoUrl: import.meta.env.VITE_REPO_URL || 'https://github.com/r-shafi/letterboxd-pro-analytics',
  authorName: import.meta.env.VITE_AUTHOR_NAME || 'Shafi Rayhan',
  authorPortfolioUrl: import.meta.env.VITE_AUTHOR_PORTFOLIO_URL || 'https://github.com/r-shafi',
  authorEmail: import.meta.env.VITE_AUTHOR_EMAIL || 'shafirayhan@proton.me',
  tmdbFallbackKey: import.meta.env.VITE_TMDB_FALLBACK_KEY || '1426684c151e5ca03cfd5a6952e73c46',
  tmdbApiBase: import.meta.env.VITE_TMDB_API_BASE || 'https://api.themoviedb.org/3',
  tmdbImageBase: 'https://image.tmdb.org/t/p',
  analyticsProvider: import.meta.env.VITE_ANALYTICS_PROVIDER || '',
  analyticsDomain: import.meta.env.VITE_ANALYTICS_DOMAIN || '',
  analyticsApiHost: import.meta.env.VITE_ANALYTICS_API_HOST || ''
};
