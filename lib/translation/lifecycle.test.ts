import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { describe, expect, it } from 'vitest';
import {
  translationEntityTypeToKey,
  translationEntityTypeFromKey,
  translationJobEntityTypeFilterValue,
} from './lifecycle';

describe('translation lifecycle enum mapping', () => {
  it('uses the canonical Series job filter while preserving other UI keys', () => {
    expect(translationJobEntityTypeFilterValue('post_series')).toBe('series');
    expect(translationJobEntityTypeFilterValue('post')).toBe('post');
    expect(translationJobEntityTypeFilterValue('program_event')).toBe('program_event');
  });

  it('maps every supported backend translation entity type to the UI key', () => {
    expect(translationEntityTypeToKey(TranslationEntityType.PAGE)).toBe('page');
    expect(translationEntityTypeToKey(TranslationEntityType.POST)).toBe('post');
    expect(translationEntityTypeToKey(TranslationEntityType.POST_SERIES)).toBe('post_series');
    expect(translationEntityTypeToKey(TranslationEntityType.WORK)).toBe('work');
    expect(translationEntityTypeToKey(TranslationEntityType.PROGRAM_EVENT)).toBe('program_event');
    expect(translationEntityTypeToKey(TranslationEntityType.ARTIST)).toBe('artist');
    expect(translationEntityTypeToKey(TranslationEntityType.LABEL)).toBe('label');
    expect(translationEntityTypeToKey(TranslationEntityType.RELEASE)).toBe('release');
    expect(translationEntityTypeToKey(TranslationEntityType.MENU)).toBe('menu');
    expect(translationEntityTypeToKey(TranslationEntityType.EMAIL_TEMPLATE)).toBe('email_template');
    expect(translationEntityTypeToKey(TranslationEntityType.EMAIL_LAYOUT)).toBe('email_layout');
    expect(translationEntityTypeToKey(TranslationEntityType.PRIVACY)).toBe('privacy');
    expect(translationEntityTypeToKey(TranslationEntityType.TERMS)).toBe('terms');
    expect(translationEntityTypeToKey(TranslationEntityType.CAMPAIGN)).toBe('campaign');
    expect(translationEntityTypeToKey(TranslationEntityType.FORM)).toBe('form');
  });

  it('rejects unspecified or unknown backend translation entity types', () => {
    expect(translationEntityTypeToKey(TranslationEntityType.UNSPECIFIED)).toBeNull();
    expect(translationEntityTypeToKey(999 as TranslationEntityType)).toBeNull();
  });

  it('maps every UI key back to the generated entity enum', () => {
    expect(translationEntityTypeFromKey('post')).toBe(TranslationEntityType.POST);
    expect(translationEntityTypeFromKey('post_series')).toBe(TranslationEntityType.POST_SERIES);
    expect(translationEntityTypeFromKey('program_event')).toBe(TranslationEntityType.PROGRAM_EVENT);
    expect(translationEntityTypeFromKey('email_template')).toBe(TranslationEntityType.EMAIL_TEMPLATE);
  });
});
