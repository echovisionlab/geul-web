import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { describe, expect, it } from 'vitest';
import { blockRoomTypeForTranslationEntity, isBlockBackedTranslationEntity } from './block-document-translation';

describe('Block-backed translation registry', () => {
  it.each([
    [TranslationEntityType.POST, 'post'],
    [TranslationEntityType.PAGE, 'page'],
    [TranslationEntityType.WORK, 'work'],
    [TranslationEntityType.PROGRAM_EVENT, 'program-event'],
    [TranslationEntityType.ARTIST, 'artist'],
    [TranslationEntityType.LABEL, 'label'],
    [TranslationEntityType.RELEASE, 'release'],
    [TranslationEntityType.CAMPAIGN, 'campaign'],
    [TranslationEntityType.EMAIL_TEMPLATE, 'email-template'],
    [TranslationEntityType.TERMS, 'terms-history'],
    [TranslationEntityType.PRIVACY, 'privacy-history'],
  ])('maps %s to %s', (entityType, roomType) => {
    expect(blockRoomTypeForTranslationEntity(entityType)).toBe(roomType);
    expect(isBlockBackedTranslationEntity(entityType)).toBe(true);
  });

  it.each([
    TranslationEntityType.FORM,
    TranslationEntityType.EMAIL_LAYOUT,
    TranslationEntityType.POST_SERIES,
    TranslationEntityType.MENU,
  ])('does not classify legacy translation domain %s as Block-backed', (entityType) => {
    expect(blockRoomTypeForTranslationEntity(entityType)).toBeUndefined();
  });
});
