import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showWordmark?: boolean;
  inverted?: boolean;
  className?: string;
}

const SIZES = {
  sm: { img: 28, text: 16 },
  md: { img: 40, text: 20 },
  lg: { img: 56, text: 24 },
  hero: { img: 88, text: 28 },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showWordmark = true,
  inverted = false,
  className = '',
}) => {
  const dims = SIZES[size];
  return (
    <span
      className={`brand-logo ${inverted ? 'brand-logo--inverted' : ''} ${className}`.trim()}
      style={{ gap: size === 'sm' ? 8 : 12 }}
    >
      <img
        src="/logo.png"
        alt="ChristNerve"
        width={dims.img}
        height={dims.img}
        style={{ width: dims.img, height: dims.img, objectFit: 'contain' }}
      />
      {showWordmark && (
        <span className="brand-logo-word" style={{ fontSize: dims.text }}>
          <span className="brand-logo-christ">Christ</span>
          <span className="brand-logo-nerve">Nerve</span>
        </span>
      )}
    </span>
  );
};

export default BrandLogo;
