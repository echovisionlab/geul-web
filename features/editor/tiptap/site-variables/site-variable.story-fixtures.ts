import { fromJson } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';
import type { Manifest } from '@/lib/queries/manifest';

export const siteVariableManifest: Manifest = {
  settings: {
    ...DEFAULT_SITE_SETTINGS_VIEW,
    site_title: 'Rawsector',
    site_origin: 'https://www.rawsector.com',
    company_name: 'Example Studio Ltd.',
    legal_email: 'legal@example.com',
    support_email: 'support@example.com',
    privacy_email: 'privacy@example.com',
    favicon_asset_set: null,
    site_og_image_url: null,
  },
  menus: { $typeName: 'api.open.v1.Menus', header: [], secondary: [], footer: [], avatarDropdown: [] },
};

export function siteVariableDocument(query = false) {
  const id = '10000000-0000-4000-8000-000000000401';
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: { nodes: [{ block: { id, paragraph: { props: {} } }, placement: { index: 0 } }] },
    localeOverlay: {
      locale: 'ko',
      blocks: [
        {
          blockId: id,
          paragraph: {
            props: {},
            content: query
              ? [{ text: { text: 'Contact us: /site' } }]
              : [
                  { text: { text: 'Welcome to ' } },
                  { siteVariable: { key: 'site.title' } },
                  { text: { text: '. For help, write to ' } },
                  { siteVariable: { key: 'contact.supportEmail', linked: true } },
                  { text: { text: '.' } },
                ],
          },
        },
      ],
    },
  });
}
