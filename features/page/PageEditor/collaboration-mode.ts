interface PageResidentMetadataInput {
  roomLocale: string | null;
  bootstrapLocale: string | null;
  localeMetadata?: { title?: string; summary?: string };
  fallbackTitle: string;
  fallbackSummary: string;
}

export function resolvePageResidentMetadata({
  roomLocale,
  bootstrapLocale,
  localeMetadata,
  fallbackTitle,
  fallbackSummary,
}: PageResidentMetadataInput): { title: string; summary: string } {
  if (!roomLocale || roomLocale !== bootstrapLocale || !localeMetadata) {
    return { title: fallbackTitle, summary: fallbackSummary };
  }
  return {
    title: localeMetadata.title ?? fallbackTitle,
    summary: localeMetadata.summary ?? fallbackSummary,
  };
}
