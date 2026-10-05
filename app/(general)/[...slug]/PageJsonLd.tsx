import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { getPageMetadataDocument } from '@/lib/queries/metadata';
import { buildPageJsonLd } from '@/lib/utils/json-ld';

export async function PageJsonLd({ slug, requestedLocale }: { slug: string; requestedLocale: string }) {
  const pageMetadata = await getPageMetadataDocument(slug, { requestedLocale });
  return pageMetadata ? <JsonLdScript data={buildPageJsonLd(pageMetadata)} /> : null;
}
