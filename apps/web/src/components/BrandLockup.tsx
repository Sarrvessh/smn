import { PRODUCT_NAME, PRODUCT_TAGLINE } from '../lib/brand';

interface BrandLockupProps {
  /** Compact: mark only (collapsed sidebar) */
  compact?: boolean;
  className?: string;
}

/** Rising signal bars — mark for finding growth signal in evidence. */
export function BrandMark({
  size = 32,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`brand-mark inline-flex shrink-0 items-center justify-center rounded-[9px] bg-accent text-accent-foreground ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={Math.round(size * 0.52)}
        height={Math.round(size * 0.52)}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect x="4.5" y="13" width="2.75" height="7" rx="1.2" fill="currentColor" />
        <rect x="9" y="8" width="2.75" height="12" rx="1.2" fill="currentColor" />
        <rect x="13.5" y="2" width="2.75" height="18" rx="1.2" fill="currentColor" />
        <rect x="18" y="9" width="2.75" height="11" rx="1.2" fill="currentColor" />
      </svg>
    </span>
  );
}

export function BrandLockup({ compact = false, className = '' }: BrandLockupProps) {
  const title = `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`;

  if (compact) {
    return (
      <span className={`inline-flex ${className}`} title={title}>
        <BrandMark size={32} />
        <span className="sr-only">{PRODUCT_NAME}</span>
      </span>
    );
  }

  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`} title={title}>
      <BrandMark size={32} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-foreground">
          {PRODUCT_NAME}
        </p>
        <p className="truncate text-[11px] font-medium tracking-tight text-muted-foreground">
          {PRODUCT_TAGLINE}
        </p>
      </div>
    </div>
  );
}
