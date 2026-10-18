import { describe, expect, it } from 'vitest';
import { parseSocialLinks, socialLinksSchema } from './social-links';

describe('social link validation compatibility', () => {
  it('parses legacy platform keys and ordered keys without changing stored values', () => {
    const links = {
      instagram: 'https://instagram.com/example',
      '0': 'https://github.com/example',
      custom: ' unchanged ',
    };
    expect(parseSocialLinks(links)).toEqual(links);
    expect(parseSocialLinks(JSON.stringify(links))).toEqual(links);
    expect(socialLinksSchema.parse(links)).toEqual(links);
  });

  it.each([undefined, null, false, 0, '', 'not json', 'null', '[]', '42', [], { instagram: 123 }, { nested: {} }])(
    'retains empty-object fallback for invalid input %j',
    (value) => {
      expect(parseSocialLinks(value)).toEqual({});
    },
  );
});
