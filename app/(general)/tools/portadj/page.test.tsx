import { readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import koMessages from '@/messages/ko.json';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: keyof typeof koMessages.tools.portadj) => koMessages.tools.portadj[key],
}));

vi.mock('@/lib/queries/metadata', () => ({
  getSiteMetadataDocument: async () => ({
    siteTitle: 'DSUB',
    canonicalOrigin: 'https://dsub.io',
    siteOgImageUrl: null,
    companyName: null,
    logoUrl: null,
    socialLinks: [],
  }),
}));

vi.mock('@mantine/core', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/features/tools/portadj/PortaDJTool', () => ({
  PortaDJTool: () => <div data-portadj-player />,
}));

import PortaDJPage, { generateMetadata } from './page';

describe('public PortaDJ route', () => {
  it('renders the player with localized public metadata and JSON-LD', async () => {
    const metadata = await generateMetadata();
    const html = renderToStaticMarkup(await PortaDJPage());

    expect(metadata.title).toBe('PortaDJ');
    expect(metadata.description).toBe(koMessages.tools.portadj.metadataDescription);
    expect(metadata.alternates?.canonical).toBe('https://dsub.io/tools/portadj');
    expect(metadata.robots).toBeUndefined();
    expect(html).toContain('data-portadj-player');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('https://dsub.io/tools/portadj');
    expect(html).toContain(koMessages.tools.portadj.metadataDescription);
  });

  it('provides PortaDJ metadata in every site locale', () => {
    const locales = readdirSync('messages').filter((filename) => filename.endsWith('.json'));
    expect(locales).toHaveLength(20);
    for (const locale of locales) {
      const messages = JSON.parse(readFileSync(`messages/${locale}`, 'utf8'));
      expect(messages.tools.portadj.metadataTitle).toBe('PortaDJ');
      expect(messages.tools.portadj.metadataDescription).toEqual(expect.any(String));
      expect(messages.tools.portadj.metadataDescription.length).toBeGreaterThan(0);
    }
  });
});
