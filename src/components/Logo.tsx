import type { CSSProperties } from 'react';

type LogoProps = {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Renders the Darayya emblem via <use> reference to the inline SVG symbol.
 * The symbol itself is included once in BaseLayout.astro.
 */
export default function Logo({ size = 44, color = 'currentColor', className = '', style }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 207 1821 1405"
      className={className}
      style={{ color, display: 'block', ...style }}
      aria-label="Darayya emblem"
    >
      <use href="#darayya-logo" />
    </svg>
  );
}
