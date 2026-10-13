import { prepareReleaseStreamingLinks } from './release-streaming-links';
import { ReleasePublicView, type ReleasePublicViewProps } from './ReleasePublicView';

export type ReleasePublicContentProps = Omit<ReleasePublicViewProps, 'streamingLinkEntries'>;

/**
 * Server boundary retains the production data contract; the rendered view is shared with the kit.
 * Streaming link glyphs are prepared here so the client view does not ship the platform icon catalog.
 */
export async function ReleasePublicContent(props: ReleasePublicContentProps) {
  return <ReleasePublicView {...props} streamingLinkEntries={prepareReleaseStreamingLinks(props.release)} />;
}
