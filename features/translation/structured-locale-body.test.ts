import { describe, expect, it } from 'vitest';
import { parseBlockLocaleBody, parsePageLocaleBody } from './structured-locale-body';

const block = { id: 'block-1', type: 'paragraph', props: {}, content: [] };

describe('structured locale body parsing', () => {
  it('accepts only the canonical Page body and bare Post block array', () => {
    expect(parsePageLocaleBody({ sections: [] })).toEqual({ sections: [] });
    expect(parseBlockLocaleBody('post', [block])).toEqual([block]);
  });

  it('rejects layout envelopes and extra Page root fields', () => {
    const layout = { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' };

    expect(parsePageLocaleBody({ layout, sections: [] })).toBeNull();
    expect(parseBlockLocaleBody('post', { layout, blocks: [block] })).toBeNull();
    expect(parseBlockLocaleBody('post', { blocks: [block] })).toBeNull();
  });

  it('keeps release descriptions and array-backed entities supported', () => {
    expect(parseBlockLocaleBody('release', { description: [block] })).toEqual([block]);
    expect(parseBlockLocaleBody('artist', [block])).toEqual([block]);
    expect(parseBlockLocaleBody('release', { description: 'invalid' })).toBeNull();
  });
});
