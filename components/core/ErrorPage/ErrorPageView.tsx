import type { CSSProperties, ReactNode } from 'react';

export interface ErrorPageViewProps {
  code?: string;
  title: string;
  description: ReactNode;
  homeLabel: string;
  homeHref?: string;
  retryLabel?: string;
  onRetry?: () => void;
  fullScreen?: boolean;
}

const actionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  minHeight: 44,
  padding: '10px 20px',
  borderRadius: 6,
  border: '1px solid currentColor',
  font: 'inherit',
  fontWeight: 600,
  lineHeight: 1.5,
  textDecoration: 'none',
  cursor: 'pointer',
};

/** Also renders inside the root boundary, without theme, translation, or navigation providers. */
export function ErrorPageView({
  code,
  title,
  description,
  homeLabel,
  homeHref = '/',
  retryLabel,
  onRetry,
  fullScreen = false,
}: ErrorPageViewProps) {
  return (
    <section
      aria-label={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        minHeight: fullScreen ? '100svh' : '72svh',
        width: '100%',
        padding: '48px 24px',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        colorScheme: 'light dark',
        color: 'var(--mantine-color-text, light-dark(#212529, #f1f3f5))',
        background: 'var(--mantine-color-body, light-dark(#ffffff, #1a1b1e))',
      }}
    >
      <div style={{ width: '100%', maxWidth: 560 }}>
        {code ? (
          <p
            aria-hidden="true"
            style={{
              margin: '0 0 16px',
              fontSize: 'clamp(4rem, 14vw, 6rem)',
              fontWeight: 700,
              lineHeight: 1,
              opacity: 0.45,
            }}
          >
            {code}
          </p>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(1.5rem, 5vw, 2rem)',
            fontWeight: 700,
            lineHeight: 1.35,
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </h1>
        <p style={{ margin: '20px 0 0', fontSize: 16, lineHeight: 1.75, opacity: 0.75, overflowWrap: 'anywhere' }}>
          {description}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 32 }}>
          {onRetry && retryLabel ? (
            <button
              type="button"
              onClick={onRetry}
              style={{ ...actionStyle, color: '#fff', background: '#1971c2', borderColor: '#1971c2' }}
            >
              {retryLabel}
            </button>
          ) : null}
          <a href={homeHref} style={{ ...actionStyle, color: 'inherit', background: 'transparent' }}>
            {homeLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
