'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { resolveSiteVariable } from '@echovisionlab/geul-common/site-variables';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import {
  isSiteVariableKey,
  resolveSiteVariableHref,
  resolveSiteVariableTokens,
  siteVariableContext,
  siteVariableHref,
} from '@/lib/site-variables';

/** SSR reads the root manifest provider; no per-reference request or client fetch. */
export function PublicSiteVariable({
  variableKey,
  linked,
  children,
}: {
  variableKey: string;
  linked?: boolean;
  children?: (value: string) => ReactNode;
}) {
  const { settings } = useSiteSettings();
  if (!isSiteVariableKey(variableKey)) {
    throw new Error(`Unknown site variable: ${variableKey}`);
  }
  const value = resolveSiteVariable(variableKey, siteVariableContext(settings));
  const content = children ? children(value) : value;
  const href = linked ? siteVariableHref(variableKey, value) : undefined;
  return href ? <a href={href}>{content}</a> : <>{content}</>;
}

/** Link labels stay ordinary authored text; only public readers expand the exact site tokens. */
export function PublicSiteVariableText({ text, children }: { text: string; children: (value: string) => ReactNode }) {
  const { settings } = useSiteSettings();
  return <>{children(resolveSiteVariableTokens(text, siteVariableContext(settings)))}</>;
}

export function PublicSiteVariableLink({ href = '', children, ...props }: ComponentPropsWithoutRef<'a'>) {
  const { settings } = useSiteSettings();
  const resolved = resolveSiteVariableHref(href, siteVariableContext(settings));
  return resolved ? (
    <a href={resolved} {...props}>
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}
