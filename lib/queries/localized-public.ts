import type { LocalizationInfo } from '@echovisionlab/geul-proto/public/translation_pb.ts';
import { normalizeLocale } from '@/lib/i18n/locale';

export interface PublicLocalizationInfoLike {
  requestedLocale: string;
  displayedLocale: string;
  sourceLocale: string;
  isFallback: boolean;
  isOriginal: boolean;
  machineGenerated: boolean;
  fallbackReason: number;
  availableLocales?: string[];
}

interface LocalizationCarrier {
  localizationInfo?: {
    sourceLocale?: string | null;
    displayedLocale?: string | null;
  } | null;
}

export function mapPublicLocalizationInfo(
  localizationInfo: LocalizationInfo | null | undefined,
): PublicLocalizationInfoLike | null {
  if (!localizationInfo) {
    return null;
  }

  return {
    requestedLocale: localizationInfo.requestedLocale,
    displayedLocale: localizationInfo.displayedLocale,
    sourceLocale: localizationInfo.sourceLocale,
    isFallback: localizationInfo.isFallback,
    isOriginal: localizationInfo.isOriginal,
    machineGenerated: localizationInfo.machineGenerated,
    fallbackReason: localizationInfo.fallbackReason,
    availableLocales: localizationInfo.availableLocales.length > 0 ? [...localizationInfo.availableLocales] : undefined,
  };
}

interface MaybeFetchSourceLocaleOptions<TResponse, TEntity extends LocalizationCarrier> {
  preferSourceLocale?: boolean;
  initialResponse: TResponse;
  entity: TEntity | null | undefined;
  fetchWithLocale: (locale: string) => Promise<TResponse>;
}

export async function maybeFetchSourceLocale<TResponse, TEntity extends LocalizationCarrier>({
  preferSourceLocale,
  initialResponse,
  entity,
  fetchWithLocale,
}: MaybeFetchSourceLocaleOptions<TResponse, TEntity>): Promise<TResponse> {
  if (!preferSourceLocale || !entity?.localizationInfo) {
    return initialResponse;
  }

  const sourceLocale = normalizeLocale(entity.localizationInfo.sourceLocale);
  const displayedLocale = normalizeLocale(entity.localizationInfo.displayedLocale);

  if (!sourceLocale || sourceLocale === displayedLocale) {
    return initialResponse;
  }

  return fetchWithLocale(sourceLocale);
}
