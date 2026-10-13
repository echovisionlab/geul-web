import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';
import { SOCIAL_ICON_DEFINITIONS } from '@/components/core/Social/platforms';
import { ServerSocialLinksDisplay } from './ServerSocialLinksDisplay';
import { prepareSocialLinksDisplay } from './prepare-social-links-display';

describe('server-prepared social links', () => {
  it('projects only configured glyph data while retaining ordering and URL platform inference', () => {
    const entries = prepareSocialLinksDisplay({
      2: 'https://signal-unit.bandcamp.com',
      0: 'https://github.com/example',
      1: 'https://instagram.com/example',
      3: 'https://unknown.example',
      spotify: '  ',
    });
    expect(entries.map(({ key, platform, label }) => ({ key, platform, label }))).toEqual([
      { key: '0', platform: 'github', label: 'GitHub' },
      { key: '1', platform: 'instagram', label: 'Instagram' },
      { key: '2', platform: 'bandcamp', label: 'Bandcamp' },
    ]);
    expect(entries[0].glyph).toEqual({
      platform: 'github',
      path: SOCIAL_ICON_DEFINITIONS.github.icon.path,
      light: '#181717',
      dark: '#f0f6fc',
    });
    expect(entries[2].glyph).toEqual({
      platform: 'bandcamp',
      path: SOCIAL_ICON_DEFINITIONS.bandcamp.icon.path,
      light: `#${SOCIAL_ICON_DEFINITIONS.bandcamp.icon.hex}`,
    });
    expect(Object.keys(JSON.parse(JSON.stringify(entries[0])).glyph).sort()).toEqual([
      'dark',
      'light',
      'path',
      'platform',
    ]);
  });

  it('returns no client view for an empty configuration', () => {
    expect(ServerSocialLinksDisplay({ links: {} })).toBeNull();
  });

  it.each(['icon', 'button', 'list'] as const)('renders %s links and selected SVGs during SSR', (variant) => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider forceColorScheme="light">
        {ServerSocialLinksDisplay({
          links: { github: 'https://github.com/example' },
          variant,
          showLabels: true,
          iconSize: 'xl',
        })}
      </DesignSystemProvider>,
    );
    expect(html).toContain('aria-label="GitHub"');
    expect(html).toContain('href="https://github.com/example"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('data-social-platform="github"');
    expect(html).toContain('data-color-mode="hoverBrand"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('width="1.25rem"');
    expect(html).toContain('--_social-brand-dark:#f0f6fc');
    expect(html).not.toContain('data-social-platform="instagram"');
  });
});
