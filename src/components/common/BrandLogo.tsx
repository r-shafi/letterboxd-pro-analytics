import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '', size = 28 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Pro Analytics Logo"
      role="img"
    >
      <rect width="32" height="32" rx="7" fill="#1b2026" stroke="#2c3440" strokeWidth="1.5" />
      {/* Analytics bars inside film frame */}
      <rect x="6" y="16" width="4" height="10" rx="1.5" fill="#40bcf4" />
      <rect x="14" y="10" width="4" height="16" rx="1.5" fill="#00e054" />
      <rect x="22" y="6" width="4" height="20" rx="1.5" fill="#ff8000" />
      {/* Perforation holes */}
      <circle cx="8" cy="7" r="1.2" fill="#99aabb" />
      <circle cx="16" cy="7" r="1.2" fill="#00e054" />
      <circle cx="24" cy="7" r="1.2" fill="#99aabb" />
    </svg>
  );
};
