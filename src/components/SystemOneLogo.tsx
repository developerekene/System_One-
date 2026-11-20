interface SystemOneLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SystemOneLogo({ size = 'md', className = '' }: SystemOneLogoProps) {
  const sizeClass =
    size === 'sm'
      ? 'text-base'
      : size === 'lg'
        ? 'text-xl'
        : 'text-lg';

  return (
    <span
      aria-label="System One"
      className={`inline-flex items-baseline font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 select-none ${sizeClass} ${className}`}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      <span>System&nbsp;</span>
      <span className="inline-flex items-center relative top-[0.08em]">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 26"
          className="w-[0.95em] h-[1.06em] text-sky-700"
          fill="none"
        >
          {/* Closed locked padlock shackle forming the crown of the letter O */}
          <path
            d="M7.5 10.5V7.25C7.5 4.63 9.51 2.5 12 2.5C14.49 2.5 16.5 4.63 16.5 7.25V10.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Padlock body shaped as an uppercase O */}
          <rect
            x="4.2"
            y="9.8"
            width="15.6"
            height="13.4"
            rx="5.5"
            fill="#0F172A"
          />
          {/* Subtle keyhole / inner O aperture */}
          <circle cx="12" cy="15.3" r="1.85" fill="#F8FAFC" />
          <path
            d="M12 16.8V19.6"
            stroke="#F8FAFC"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span>ne</span>
    </span>
  );
}
