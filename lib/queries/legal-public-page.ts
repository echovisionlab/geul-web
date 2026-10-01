import { timestampDate } from '@bufbuild/protobuf/wkt';
import type { Privacy as PublicPrivacy } from '@echovisionlab/geul-proto/public/privacy_pb.ts';
import type { Terms as PublicTerms } from '@echovisionlab/geul-proto/public/terms_pb.ts';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { mapPublicLocalizationInfo } from '@/lib/queries/localized-public';

type PublicLegalEntity = PublicPrivacy | PublicTerms;

export function mapPublicLegalPage(
  active: PublicLegalEntity | null | undefined,
  scheduled: PublicLegalEntity | null | undefined,
) {
  return {
    active: active
      ? {
          id: active.id,
          version: active.version,
          title: active.title,
          content: active.document ? materializeLocalizedRichTextTree(active.document) : null,
          localizationInfo: mapPublicLocalizationInfo(active.localizationInfo),
          status: 'active' as const,
          effectiveFrom: active.effectiveFrom ? timestampDate(active.effectiveFrom) : null,
          createdAt: null,
        }
      : null,
    scheduled: scheduled
      ? {
          id: scheduled.id,
          version: scheduled.version,
          title: scheduled.title,
          localizationInfo: mapPublicLocalizationInfo(scheduled.localizationInfo),
          status: 'scheduled' as const,
          effectiveFrom: scheduled.effectiveFrom ? timestampDate(scheduled.effectiveFrom) : null,
        }
      : null,
  };
}

export type PublicLegalPageData = ReturnType<typeof mapPublicLegalPage>;

export interface PublicLegalPageInitialData {
  requestedLocale: string;
  data: PublicLegalPageData;
  updatedAt: number;
}
