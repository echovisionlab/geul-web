import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { FileDownloadPolicyEditorAdapter } from '@/features/media-download/FileDownloadPolicyEditor';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import {
  ConnectedMediaDownloadPolicyPanel,
  MediaDownloadPolicyAdapterProvider,
} from './ConnectedMediaDownloadPolicyPanel';
import { MediaDownloadPolicyPanel } from './MediaDownloadPolicyPanel';

vi.mock('@/features/media-download/FileDownloadPolicyEditor', () => ({
  FileDownloadPolicyEditor: (props: {
    entityType: number;
    entityId: string;
    blockId: string;
    referencePath: string;
    expectedFileId: string;
    presentation?: string;
  }) => (
    <div
      data-testid="download-policy"
      data-entity-type={props.entityType}
      data-entity-id={props.entityId}
      data-block-id={props.blockId}
      data-reference-path={props.referencePath}
      data-file-id={props.expectedFileId}
      data-presentation={props.presentation}
    />
  ),
}));
vi.mock('@/lib/actions/file-download-access', () => ({
  getFileDownloadPolicyAction: vi.fn(),
  listAudienceSegmentsForAuthenticatedAccessAction: vi.fn(),
  updateFileDownloadPolicyAction: vi.fn(),
}));

function renderPanel(panel: React.ReactNode): string {
  return renderToStaticMarkup(<MantineProvider>{panel}</MantineProvider>);
}

const adapter = {} as FileDownloadPolicyEditorAdapter;

describe('MediaDownloadPolicyPanel', () => {
  it('is hidden without a media target', () => {
    expect(
      renderPanel(
        <MediaDownloadPolicyPanel
          fileId={null}
          blockId={null}
          blockType={null}
          runtimeTarget={null}
          adapter={adapter}
        />,
      ),
    ).not.toContain('data-testid="download-policy"');
  });

  it.each([TranscodeEntityType.POST, TranscodeEntityType.PAGE] as const)(
    'shows the policy editor for a persisted file on runtime target %s',
    (entityType) => {
      const html = renderPanel(
        <MediaDownloadPolicyPanel
          fileId="persisted-file"
          blockId="block-1"
          blockType="file"
          runtimeTarget={{ entityType, entityId: ' entity-1 ' }}
          adapter={adapter}
        />,
      );

      expect(html).toContain('data-testid="download-policy"');
      expect(html).toContain('data-file-id="persisted-file"');
      expect(html).toContain('data-block-id="block-1"');
      expect(html).toContain('data-reference-path="file"');
      expect(html).toContain('data-entity-id="entity-1"');
      expect(html).toContain('data-presentation="media-header"');
    },
  );

  it.each([TranscodeEntityType.WORK, TranscodeEntityType.PROGRAM_EVENT] as const)(
    'shows the exact relation policy for files on %s editors',
    (entityType) => {
      expect(
        renderPanel(
          <MediaDownloadPolicyPanel
            fileId="persisted-file"
            blockId="block-1"
            blockType="file"
            runtimeTarget={{ entityType, entityId: 'entity-1' }}
            adapter={adapter}
          />,
        ),
      ).toContain('data-testid="download-policy"');
    },
  );

  it.each([
    ['post', TranscodeEntityType.POST],
    ['page', TranscodeEntityType.PAGE],
    ['work', TranscodeEntityType.WORK],
    ['program_event', TranscodeEntityType.PROGRAM_EVENT],
  ] as const)('maps the %s editor runtime to its exact File Block policy target', (entityType, protoEntityType) => {
    const html = renderPanel(
      <EditorRuntimeProvider provider={null} entityType={entityType} entityId="entity-1">
        <MediaDownloadPolicyAdapterProvider adapter={adapter}>
          <ConnectedMediaDownloadPolicyPanel fileId="file-1" blockId="block-1" blockType="file" />
        </MediaDownloadPolicyAdapterProvider>
      </EditorRuntimeProvider>,
    );

    expect(html).toContain(`data-entity-type="${protoEntityType}"`);
    expect(html).toContain('data-entity-id="entity-1"');
    expect(html).toContain('data-block-id="block-1"');
    expect(html).toContain('data-reference-path="file"');
    expect(html).toContain('data-file-id="file-1"');
  });

  it('stays hidden when the file is not persisted', () => {
    expect(
      renderPanel(
        <MediaDownloadPolicyPanel
          fileId=""
          blockId="block-1"
          blockType="file"
          runtimeTarget={{ entityType: TranscodeEntityType.POST, entityId: 'post-1' }}
          adapter={adapter}
        />,
      ),
    ).not.toContain('data-testid="download-policy"');
  });

  it('stays hidden without an authoritative runtime target even if hydration props contain one', () => {
    expect(
      renderPanel(
        <MediaDownloadPolicyPanel
          fileId="persisted-file"
          blockId="block-1"
          blockType="file"
          runtimeTarget={null}
          adapter={adapter}
        />,
      ),
    ).not.toContain('data-testid="download-policy"');
  });
});
