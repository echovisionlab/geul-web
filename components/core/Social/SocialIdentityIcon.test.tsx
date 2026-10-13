// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { prepareSocialIcon, SocialIcon } from './SocialIcon';
import { siGithub } from 'simple-icons';
import { GITHUB_IDENTITY_ICON_HEX, GITHUB_IDENTITY_ICON_PATH, SocialIdentityIcon } from './SocialIdentityIcon';

describe('SocialIdentityIcon', () => {
  it.each(['google', 'github'] as const)('renders the same %s mark as SocialIcon without the catalog', (platform) => {
    for (const props of [
      {},
      { colorMode: 'brand', size: 'md' },
      { colorMode: 'hoverBrand', size: 'sm', label: 'Account' },
    ] as const) {
      expect(renderToStaticMarkup(<SocialIdentityIcon platform={platform} {...props} />)).toBe(
        renderToStaticMarkup(<SocialIcon platform={platform} {...props} />),
      );
    }
  });

  it('keeps the inlined GitHub glyph equal to simple-icons', () => {
    expect(GITHUB_IDENTITY_ICON_PATH).toBe(siGithub.path);
    expect(GITHUB_IDENTITY_ICON_HEX).toBe(siGithub.hex);
  });

  it('uses the catalog GitHub brand colors and dark override', () => {
    const markup = renderToStaticMarkup(<SocialIdentityIcon platform="github" colorMode="brand" />);
    const { path, light, dark } = prepareSocialIcon('github');

    expect(markup).toContain(`d="${path}"`);
    expect(markup).toContain(`--_social-brand-light:${light}`);
    expect(markup).toContain(`--_social-brand-dark:${dark}`);
  });
});
