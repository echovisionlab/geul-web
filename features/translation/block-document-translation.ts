import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import type { BlockRoomDocumentType } from '@/lib/collab/block-room-bootstrap';

const blockRoomTypeByTranslationEntity = new Map<TranslationEntityType, BlockRoomDocumentType>([
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
]);

export function blockRoomTypeForTranslationEntity(
  entityType: TranslationEntityType,
): BlockRoomDocumentType | undefined {
  return blockRoomTypeByTranslationEntity.get(entityType);
}

export function isBlockBackedTranslationEntity(entityType: TranslationEntityType): boolean {
  return blockRoomTypeByTranslationEntity.has(entityType);
}
