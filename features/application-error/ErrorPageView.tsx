'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { ErrorPageView as CoreErrorPageView, type ErrorPageViewProps } from '@/components/core/ErrorPage/ErrorPageView';
import { LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { errorCodeFrameStyle } from './error-code-frame';

type ErrorCodeVisual = ComponentType<{ code: string }>;

// Mirrors the particle host's initial markup: the reserved frame and a hidden plain code that
// becomes visible when the particle renderer cannot be used.
function ErrorCodeFrame({ code, visible }: { code: string; visible: boolean }) {
  return (
    <div aria-hidden="true" style={errorCodeFrameStyle} data-error-code={code}>
      <div data-error-fallback style={{ position: 'absolute', inset: 0, opacity: visible ? 1 : 0 }}>
        <LayoutStack fill="both" align="center" justify="center" gap="none">
          <Text size="display" weight="strong" align="center" tone="secondary">
            {code}
          </Text>
        </LayoutStack>
      </div>
    </div>
  );
}

const PlainErrorCode: ErrorCodeVisual = ({ code }) => <ErrorCodeFrame code={code} visible />;

// Error boundaries are part of every route's first load, so the decorative particle renderer
// (and its Three/Ionian runtime loader) is fetched only when an error page renders. If that chunk
// cannot load, for example after a deployment, the plain code is shown instead.
function DeferredErrorCodeParticles({ code }: { code: string }) {
  const [Visual, setVisual] = useState<ErrorCodeVisual | null>(null);
  useEffect(() => {
    let active = true;
    import('./ErrorCodeParticles')
      .then((module) => module.ErrorCodeParticles as ErrorCodeVisual)
      .catch(() => PlainErrorCode)
      .then((component) => {
        if (active) {
          setVisual(() => component);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return Visual ? <Visual code={code} /> : <ErrorCodeFrame code={code} visible={false} />;
}

export function ErrorPageView(props: Omit<ErrorPageViewProps, 'codeVisual'>) {
  return (
    <CoreErrorPageView
      {...props}
      codeVisual={props.code ? <DeferredErrorCodeParticles code={props.code} /> : undefined}
    />
  );
}
