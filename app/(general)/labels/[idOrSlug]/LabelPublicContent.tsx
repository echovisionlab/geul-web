import { prepareSocialLinksDisplay } from '@/features/social-links/prepare-social-links-display';
import { LabelPublicView, type LabelPublicViewProps } from './LabelPublicView';
import { prepareLabelPublicView } from './label-public-prepared';

export type LabelPublicContentProps = Omit<
  LabelPublicViewProps,
  'socialLinkEntries' | 'releaseListProps' | 'artistListProps' | 'countryName'
>;

/**
 * Server boundary retains the production data contract; the rendered view is shared with the kit.
 * Social link glyphs, list block props and the country name are prepared here so the client view does not
 * ship the platform icon catalog, zod or the country catalogue.
 */
export async function LabelPublicContent(props: LabelPublicContentProps) {
  return (
    <LabelPublicView
      {...props}
      {...prepareLabelPublicView(props.label, props.uiLocale)}
      socialLinkEntries={prepareSocialLinksDisplay(props.label.socialLinks ?? {})}
    />
  );
}
