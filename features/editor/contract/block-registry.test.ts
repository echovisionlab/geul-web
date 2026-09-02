import { describe, expect, it } from 'vitest';
import { pageSectionKinds, richTextBlockKinds } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { RichTextProfile } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  assertPageContainerPlacement,
  assertRichTextProfileAllows,
  contentBlockProfileForRichTextProfile,
  pageSectionRegistry,
  profileSupportsParagraphExternalVideo,
  requireHeadingLevel,
  requirePageSectionKind,
  requireRichTextBlockKind,
  richTextBlockDefaults,
  richTextBlockRegistry,
  richTextFieldOwnership,
} from './block-registry';

describe('generated Block adapter registry', () => {
  it('exhaustively registers every generated rich-text Block and Page section', () => {
    expect(Object.keys(richTextBlockRegistry)).toEqual(richTextBlockKinds);
    expect(Object.keys(pageSectionRegistry)).toEqual(pageSectionKinds);
  });

  it('fails closed for unknown kinds and headings outside levels 1-3', () => {
    expect(() => requireRichTextBlockKind('image')).toThrow('Unsupported rich-text Block kind');
    expect(() => requirePageSectionKind('future-section')).toThrow('Unsupported Page section kind');
    expect(() => requireHeadingLevel(4)).toThrow('Unsupported heading level');
  });

  it('uses generated profiles, ownership, and defaults', () => {
    expect(() => assertRichTextProfileAllows('page', 'map')).toThrow('does not allow map');
    expect(() => assertRichTextProfileAllows('post', 'map')).not.toThrow();
    expect(richTextFieldOwnership('file', 'name')).toBe('shared');
    expect(richTextFieldOwnership('file', 'alt')).toBe('locale');
    expect(richTextBlockDefaults('heading').get('level')).toBe(1);
  });

  it('reads paragraph external-video availability from generated profile data', () => {
    expect(contentBlockProfileForRichTextProfile(RichTextProfile.POST)).toBe('post');
    expect(contentBlockProfileForRichTextProfile(RichTextProfile.PAGE)).toBe('page');
    expect(profileSupportsParagraphExternalVideo('post')).toBe(true);
    expect(profileSupportsParagraphExternalVideo('page')).toBe(true);
    expect(profileSupportsParagraphExternalVideo('work')).toBe(false);
    expect(profileSupportsParagraphExternalVideo('program_event')).toBe(false);
  });

  it('maps Page columns as the only nested section container', () => {
    expect(() => assertPageContainerPlacement('columns', 'rich-text')).not.toThrow();
    expect(() => assertPageContainerPlacement('columns', 'columns')).toThrow('cannot be placed');
    expect(() => assertPageContainerPlacement('rich-text', 'map')).toThrow('cannot be placed');
  });
});
