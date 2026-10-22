import React, { useState, useEffect, useRef } from 'react';
import { Film as FilmIcon } from 'lucide-react';

interface PosterImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
  onLoad?: () => void;
  onClick?: () => void;
  loading?: 'lazy' | 'eager';
}

const RETRY_INTERVALS = [500, 1500, 3000]; // 3 progressive retry delays
const MAX_RETRIES = 3;

export const PosterImage: React.FC<PosterImageProps> = ({
  src,
  alt,
  className = '',
  fallbackIcon,
  onLoad,
  onClick,
  loading = 'lazy'
}) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isError, setIsError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset retry state when src changes
  useEffect(() => {
    setRetryCount(0);
    setIsError(false);
    setIsLoaded(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [src]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!src || isError) {
    return (
      <div
        className={`flex items-center justify-center bg-[#1b2026] text-[#99aabb]/40 ${className}`}
        onClick={onClick}
        title={alt}
      >
        {fallbackIcon || <FilmIcon className="h-6 w-6 stroke-1" />}
      </div>
    );
  }

  // Generate cache-busting url on retries
  const currentSrc =
    retryCount > 0
      ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryCount}&t=${Date.now()}`
      : src;

  const handleError = () => {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_INTERVALS[retryCount] || 1500;
      timeoutRef.current = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
      }, delay);
    } else {
      setIsError(true);
    }
  };

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      onLoad={handleLoad}
      onError={handleError}
      onClick={onClick}
      className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'}`}
    />
  );
};
