import { resolveSiteVariable, type SiteVariableContext } from '@echovisionlab/geul-common/site-variables';
import { isSiteVariableKey } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';

/** The public manifest is the only source of values for authored references. */
export function siteVariableContext(settings: {
  site_title: string;
  site_origin: string;
  company_name: string;
  legal_email: string;
  support_email: string;
  privacy_email: string;
}): SiteVariableContext {
  return {
    siteTitle: settings.site_title ?? '',
    siteUrl: settings.site_origin ?? '',
    companyName: settings.company_name ?? '',
    legalEmail: settings.legal_email ?? '',
    supportEmail: settings.support_email ?? '',
    privacyEmail: settings.privacy_email ?? '',
  };
}

export function canLinkSiteVariable(key: string): boolean {
  return key === 'site.url' || (isSiteVariableKey(key) && key.startsWith('contact.'));
}

export function siteVariableHref(key: string, value: string): string | undefined {
  if (
    !value ||
    !canLinkSiteVariable(key) ||
    Array.from(value).some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)
  ) {
    return undefined;
  }
  if (key !== 'site.url') {
    return safePublicHref(`mailto:${value}`);
  }
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? value : undefined;
  } catch {
    return undefined;
  }
}

/** One pass: values that resemble tokens remain ordinary data. */
export function resolveSiteVariableTokens(source: string, context?: SiteVariableContext): string {
  return source.replace(/\{\{([^{}]+)\}\}/gu, (token: string, key: string) => {
    if (!isSiteVariableKey(key)) {
      return token;
    }
    if (!context) {
      throw new Error('Site variable context is required for token output.');
    }
    return resolveSiteVariable(key, context);
  });
}

/** Public output only: expand once, then validate the resulting destination. Never persist it. */
export function resolveSiteVariableHref(source: string, context?: SiteVariableContext): string | undefined {
  return safePublicHref(resolveSiteVariableTokens(source, context));
}

function safePublicHref(resolved: string): string | undefined {
  if (Array.from(resolved).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    return undefined;
  }
  // Check before normalization so trimming cannot hide whitespace in a substituted mailto value.
  if (
    resolved.trimStart().toLowerCase().startsWith('mailto:') &&
    (resolved.toLowerCase() === 'mailto:' ||
      Array.from(resolved).some(
        (character) => /\s/u.test(character) || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
      ))
  ) {
    return undefined;
  }
  const href = normalizeRichTextHref(resolved);
  // Backslashes are interpreted as slashes by browsers for network-path references.
  return href && !/^[\\/]{2}/u.test(href) ? href : undefined;
}

export const siteVariableLabelKeys = {
  'site.title': 'siteTitle',
  'site.url': 'siteUrl',
  'site.companyName': 'companyName',
  'contact.legalEmail': 'legalEmail',
  'contact.supportEmail': 'supportEmail',
  'contact.privacyEmail': 'privacyEmail',
} as const;
