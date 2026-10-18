// @vitest-environment node
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { LoginErrorPageView } from '@/features/auth/LoginErrorPageView';
import { ChangelogPageView } from '@/features/changelog/ChangelogPageView';
function render(view: ReactNode) {
  return renderToStaticMarkup(<TestProviders>{view}</TestProviders>);
}
describe('production public page previews', () => {
  it('offers account recovery only for pending deletion', () => {
    const pending = render(<LoginErrorPageView error={{ id: 'account_pending_deletion' }} />);
    expect(pending).toMatch(/<a\b[^>]*href="\/account\/recover"[^>]*>.*?Recover Account/);
    const banned = render(<LoginErrorPageView error={{ id: 'account_banned' }} />);
    expect(banned).not.toContain('href="/account/recover"');
    expect(banned).toMatch(/<a\b[^>]*href="\/login"[^>]*>.*?Back to Login/);
  });
  it('keeps authored changelog release anchors and safe external links', () => {
    const markup = render(
      <ChangelogPageView
        releases={[
          {
            version: '0.11.2',
            date: '2026-10-10',
            url: null,
            groups: [
              {
                title: 'Fixes',
                items: [
                  {
                    rawText: 'Issue',
                    parts: [
                      { type: 'link', text: 'Issue', href: 'https://github.com/echovisionlab/geul-web/issues/1' },
                    ],
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );
    expect(markup).toMatch(/id="release-0\.11\.2"[^>]*>0\.11\.2</);
    const link = markup.match(/<a\b[^>]*href="https:\/\/github\.com\/echovisionlab\/geul-web\/issues\/1"[^>]*>/)?.[0];
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(markup).toMatch(/id="release-0\.11\.2-fixes"[^>]*>Fixes</);
    expect(markup).toContain('lang="en"');
  });
});
