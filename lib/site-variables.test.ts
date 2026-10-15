import { describe, expect, it } from 'vitest';
import { siteVariableHrefCases } from '@/test/site-variable-link';
import { siteVariableManifest } from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import {
  canLinkSiteVariable,
  resolveSiteVariableTokens,
  resolveSiteVariableHref,
  siteVariableContext,
  siteVariableHref,
} from './site-variables';

const context = siteVariableContext(siteVariableManifest.settings);
describe('public site variable projection', () => {
  it.each(siteVariableHrefCases)('resolves and validates href: $name', ({ source, expected, settings }) => {
    expect(
      resolveSiteVariableHref(source, siteVariableContext({ ...siteVariableManifest.settings, ...settings })),
    ).toBe(expected);
  });
  it.each(['//evil.example/path', '\\\\evil.example/path', 'data:text/html,bad', 'vbscript:bad'])(
    'rejects unsafe destinations: %s',
    (href) => {
      expect(resolveSiteVariableHref(href, context)).toBeUndefined();
    },
  );

  it('resolves the six exact tokens once and preserves ordinary braces and unknown names', () => {
    expect(
      resolveSiteVariableTokens(
        '{{site.title}} | {{site.url}} | {{site.companyName}} | {{contact.legalEmail}} | {{contact.supportEmail}} | {{contact.privacyEmail}}',
        context,
      ),
    ).toBe(
      'rawsector | https://www.rawsector.com | Example Studio Ltd. | legal@example.com | support@example.com | privacy@example.com',
    );
    expect(
      resolveSiteVariableTokens('{{site.title}} {{Site.title}} {{other}}', { ...context, siteTitle: '{{site.url}}' }),
    ).toBe('{{site.url}} {{Site.title}} {{other}}');
    expect(resolveSiteVariableTokens('A{{site.title}}B', { ...context, siteTitle: '' })).toBe('AB');
  });
  it('requires a context only when an exact token needs resolving', () => {
    expect(resolveSiteVariableTokens('{{site.unknown}} {{Site.title}}')).toBe('{{site.unknown}} {{Site.title}}');
    expect(() => resolveSiteVariableTokens('{{site.title}}')).toThrow('Site variable context is required');
  });
  it('links only a nonempty site URL or contact value and rejects unsafe output targets', () => {
    expect(canLinkSiteVariable('site.title')).toBe(false);
    expect(canLinkSiteVariable('site.companyName')).toBe(false);
    expect(siteVariableHref('contact.supportEmail', 'support@example.com')).toBe('mailto:support@example.com');
    expect(siteVariableHref('site.url', context.siteUrl)).toBe(context.siteUrl);
    expect(siteVariableHref('contact.legalEmail', '')).toBeUndefined();
    expect(siteVariableHref('contact.legalEmail', 'legal@example.com\nBcc:x@example.com')).toBeUndefined();
    // eslint-disable-next-line no-script-url -- Exercise rejection at the public output boundary.
    expect(siteVariableHref('site.url', 'javascript:alert(1)')).toBeUndefined();
  });
});
