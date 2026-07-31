/** Shared SVG icons — one stroke language for the workspace. */

import type { ReactNode } from 'react';

type IconProps = {
  className?: string;
  title?: string;
};

function base(props: IconProps & { children: ReactNode }) {
  const { className, title, children } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-4 w-4'}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
  });
}

export function IconPlus(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
  });
}

export function IconSidebar(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </>
    ),
  });
}

export function IconPanel(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M4 6h10" />
        <path d="M4 12h16" />
        <path d="M4 18h12" />
      </>
    ),
  });
}

export function IconSources(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M8 6h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8" />
        <path d="M6 4h.01" />
        <rect x="3" y="4" width="5" height="16" rx="1.5" />
      </>
    ),
  });
}

export function IconClose(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
      </>
    ),
  });
}

export function IconSun(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M18.4 5.6l-1.1 1.1M6.7 17.3l-1.1 1.1" />
      </>
    ),
  });
}

export function IconMoon(props: IconProps) {
  return base({
    ...props,
    children: <path d="M16.5 3.5A8.5 8.5 0 1 0 20.5 14 6.5 6.5 0 0 1 16.5 3.5z" />,
  });
}

export function IconSystem(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
  });
}

export function IconSend(props: IconProps) {
  return base({
    ...props,
    children: <path d="M5 12h14M13 6l6 6-6 6" />,
  });
}

export function IconStop(props: IconProps) {
  return base({
    ...props,
    children: <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />,
  });
}

export function IconCopy(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M5 14V6a2 2 0 0 1 2-2h8" />
      </>
    ),
  });
}

export function IconRetry(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M4 12a8 8 0 1 0 2.3-5.7" />
        <path d="M4 4v5h5" />
      </>
    ),
  });
}

export function IconMore(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),
  });
}

export function IconExpand(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M9 5H5v4" />
        <path d="M15 5h4v4" />
        <path d="M5 15v4h4" />
        <path d="M19 15v4h-4" />
      </>
    ),
  });
}
