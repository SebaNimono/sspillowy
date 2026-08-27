import React from 'react';

type MarkProps = { className?: string; title?: string };

const Svg: React.FC<MarkProps & { children: React.ReactNode; viewBox?: string }> = ({
  children,
  className,
  title,
  viewBox = '0 0 24 24',
}) => (
  <svg
    className={className}
    viewBox={viewBox}
    width="1em"
    height="1em"
    fill="currentColor"
    aria-hidden={title ? undefined : true}
    role={title ? 'img' : undefined}
  >
    {title ? <title>{title}</title> : null}
    {children}
  </svg>
);

/** Marcas monocromo (paths tipo Simple Icons). Uso editorial/UI; marcas = de cada titular. */
export const BrandMarks = {
  github: (p: MarkProps) => (
    <Svg {...p} title={p.title ?? 'GitHub'}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </Svg>
  ),
  gitlab: (p: MarkProps) => (
    <Svg {...p} title={p.title ?? 'GitLab'}>
      <path d="M23.955 13.587l-1.34-4.122-2.655-8.168a.455.455 0 00-.867 0L16.437 9.46H7.56L4.91 1.295a.455.455 0 00-.868 0L1.386 9.46.044 13.587a.924.924 0 00.331 1.023L12 23.054l11.625-8.443a.92.92 0 00.33-1.024" />
    </Svg>
  ),
  google: (p: MarkProps) => (
    <Svg {...p} title={p.title ?? 'Google'}>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .533 5.387.533 12S5.867 24 12.48 24c3.44 0 6.04-1.13 8.053-3.253 2.08-2.08 2.747-5.027 2.747-7.427 0-.76-.053-1.467-.173-2.053H12.48z" />
    </Svg>
  ),
  microsoft: (p: MarkProps) => (
    <Svg {...p} title={p.title ?? 'Microsoft'}>
      <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.628h11.377V24H0zm12.623 0H24V24H12.623" />
    </Svg>
  ),
  semgrep: (p: MarkProps) => (
    <Svg {...p} title={p.title ?? 'Semgrep'}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 3.6c1.8 0 3.3.6 4.5 1.8l-2.1 2.1A4.2 4.2 0 0012 6.6a5.4 5.4 0 00-5.4 5.4c0 1.2.4 2.3 1.1 3.2L5.6 17.3A8.35 8.35 0 013.6 12 8.4 8.4 0 0112 3.6zm6.3 2.7A8.35 8.35 0 0120.4 12a8.4 8.4 0 01-8.4 8.4 8.35 8.35 0 01-5.7-2.1l2.1-2.1a5.4 5.4 0 007.5-7.5l2.4-2.4z" />
    </Svg>
  ),
  trivy: (p: MarkProps) => (
    <Svg {...p} title={p.title ?? 'Trivy'} viewBox="0 0 24 24">
      <path d="M12 1.5L2.5 6.75v10.5L12 22.5l9.5-5.25V6.75L12 1.5zm0 2.2l7.1 3.92v7.76L12 19.3l-7.1-3.92V7.62L12 3.7zm-3.2 5.05v6.5h1.7V12.4h2.9c1.85 0 3.1-1.05 3.1-2.65 0-1.55-1.2-2.55-3-2.55H8.8zm1.7 1.4h2.55c.85 0 1.35.4 1.35 1.1s-.5 1.15-1.4 1.15H10.5v-2.25z" />
    </Svg>
  ),
  gitleaks: (p: MarkProps) => (
    <Svg {...p} title={p.title ?? 'GitLeaks'}>
      <path d="M17 8h-1V6a4 4 0 10-8 0v2H7a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2v-9a2 2 0 00-2-2zM9.5 6a2.5 2.5 0 015 0v2h-5V6zM12 17.25a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5z" />
    </Svg>
  ),
  owasp: (p: MarkProps) => (
    <Svg {...p} title={p.title ?? 'OWASP'}>
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5zm0 2.2l7 3.9v4.4c0 4.1-2.8 8-7 9.1-4.2-1.1-7-5-7-9.1V8.1l7-3.9zm0 3.05a4.75 4.75 0 100 9.5 4.75 4.75 0 000-9.5zm0 1.7a3.05 3.05 0 110 6.1 3.05 3.05 0 010-6.1z" />
    </Svg>
  ),
  iso: (p: MarkProps) => (
    <Svg {...p} title={p.title ?? 'ISO/IEC 27001'}>
      <path d="M6 2h9l5 5v15a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm8 1.5V8h4.5L14 3.5zM8 11h8v1.5H8V11zm0 3.5h8V16H8v-1.5zm0 3.5h5.5V19H8v-1.5z" />
    </Svg>
  ),
  cwe: (p: MarkProps) => (
    <Svg {...p} title={p.title ?? 'CWE'}>
      <path d="M4 4h16v4H4V4zm0 6h10v4H4v-4zm0 6h16v4H4v-4z" />
    </Svg>
  ),
  hitl: (p: MarkProps) => (
    <Svg {...p} title={p.title ?? 'HITL'}>
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7.5 9a7.5 7.5 0 0115 0v1H4.5v-1z" />
    </Svg>
  ),
};

export type BrandKey = keyof typeof BrandMarks;

export const BrandChip: React.FC<{
  mark: BrandKey;
  label: string;
  className?: string;
}> = ({ mark, label, className }) => {
  const Icon = BrandMarks[mark];
  return (
    <span className={className ?? 'site-brand-chip'}>
      <Icon />
      <em>{label}</em>
    </span>
  );
};
