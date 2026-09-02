import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { describe, expect, it } from 'vitest';
import {
  getCommonTranslationEntityLabelKey,
  getTranslationEntityHref,
  getTranslationEntityLabelKey,
} from './entity-type';

describe('translation entity-type helpers', () => {
  it('maps generated enum values to label keys without compatibility aliases', () => {
    expect(
      [
        TranslationEntityType.POST,
        TranslationEntityType.POST_SERIES,
        TranslationEntityType.PAGE,
        TranslationEntityType.WORK,
        TranslationEntityType.MENU,
        TranslationEntityType.ARTIST,
        TranslationEntityType.LABEL,
        TranslationEntityType.RELEASE,
        TranslationEntityType.EMAIL_TEMPLATE,
        TranslationEntityType.EMAIL_LAYOUT,
        TranslationEntityType.CAMPAIGN,
        TranslationEntityType.FORM,
        TranslationEntityType.PROGRAM_EVENT,
        TranslationEntityType.PRIVACY,
        TranslationEntityType.TERMS,
      ].map(getTranslationEntityLabelKey),
    ).toEqual([
      'post',
      'series',
      'page',
      'work',
      'menu',
      'artist',
      'label',
      'release',
      'emailTemplate',
      'emailLayout',
      'campaign',
      'form',
      'programEvent',
      'privacy',
      'terms',
    ]);
    expect(getTranslationEntityLabelKey(null)).toBe('unknown');
    expect(getTranslationEntityLabelKey(TranslationEntityType.UNSPECIFIED)).toBe('unknown');
  });

  it('returns common label keys only for shared common namespaces', () => {
    expect(getCommonTranslationEntityLabelKey(TranslationEntityType.CAMPAIGN)).toBe('campaign');
    expect(getCommonTranslationEntityLabelKey(TranslationEntityType.EMAIL_LAYOUT)).toBe('emailLayout');
    expect(getCommonTranslationEntityLabelKey(TranslationEntityType.POST_SERIES)).toBe('series');
    expect(getCommonTranslationEntityLabelKey(TranslationEntityType.PROGRAM_EVENT)).toBe('programEvent');
    expect(getCommonTranslationEntityLabelKey(TranslationEntityType.UNSPECIFIED)).toBeNull();
  });

  it('builds entity hrefs for supported targets and rejects invalid targets', () => {
    expect(
      getTranslationEntityHref({
        entityType: TranslationEntityType.POST,
        entityId: 'post-1',
      }),
    ).toBe('/posts/post-1?edit=true');
    expect(
      getTranslationEntityHref({
        entityType: TranslationEntityType.POST_SERIES,
        entityId: 'series-1',
      }),
    ).toBe('/admin/series/series-1');
    expect(
      getTranslationEntityHref({
        entityType: TranslationEntityType.PAGE,
        entityId: 'page-1',
      }),
    ).toBe('/page-1?edit=true');
    expect(
      getTranslationEntityHref({
        entityType: TranslationEntityType.MENU,
        entityId: 'menu-1',
      }),
    ).toBe('/admin/menus');
    expect(
      getTranslationEntityHref({
        entityType: TranslationEntityType.EMAIL_LAYOUT,
        entityId: 'layout-1',
      }),
    ).toBe('/admin/email-layouts/layout-1');
    expect(getTranslationEntityHref({ entityType: TranslationEntityType.LABEL, entityId: 'label-1' })).toBe(
      '/labels/label-1?edit=true',
    );
    expect(getTranslationEntityHref({ entityType: TranslationEntityType.RELEASE, entityId: 'release-1' })).toBe(
      '/releases/release-1?edit=true',
    );
    expect(getTranslationEntityHref({ entityType: TranslationEntityType.PROGRAM_EVENT, entityId: 'event-1' })).toBe(
      '/events/event-1?edit=true',
    );
    expect(getTranslationEntityHref({ entityType: TranslationEntityType.POST, entityId: '' })).toBeNull();
    expect(getTranslationEntityHref({ entityType: TranslationEntityType.UNSPECIFIED, entityId: 'x' })).toBeNull();
    expect(getTranslationEntityHref(null)).toBeNull();
  });
});
