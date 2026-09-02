'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { EditorMediaBlockType } from '@/features/editor/lib/media-block-updates';
import type { FileDownloadPolicyEditorAdapter } from '@/features/media-download/FileDownloadPolicyEditor';
import {
  getFileDownloadPolicyAction,
  listAudienceSegmentsForAuthenticatedAccessAction,
  updateFileDownloadPolicyAction,
} from '@/lib/actions/file-download-access';
import { useOptionalEditorRuntimeContext } from '@/lib/contexts/EditorRuntimeContext';
import { MediaDownloadPolicyPanel, type MediaDownloadPolicyRuntimeTarget } from './MediaDownloadPolicyPanel';

export const connectedMediaDownloadPolicyAdapter = {
  loadPolicy: getFileDownloadPolicyAction,
  loadSegments: listAudienceSegmentsForAuthenticatedAccessAction,
  savePolicy: updateFileDownloadPolicyAction,
};

const MediaDownloadPolicyAdapterContext = createContext<FileDownloadPolicyEditorAdapter | null>(null);

export function MediaDownloadPolicyAdapterProvider({
  adapter,
  children,
}: {
  adapter: FileDownloadPolicyEditorAdapter;
  children: ReactNode;
}) {
  return (
    <MediaDownloadPolicyAdapterContext.Provider value={adapter}>{children}</MediaDownloadPolicyAdapterContext.Provider>
  );
}

export function useConnectedMediaDownloadPolicyAdapter(): FileDownloadPolicyEditorAdapter {
  return useContext(MediaDownloadPolicyAdapterContext) ?? connectedMediaDownloadPolicyAdapter;
}

interface ConnectedMediaDownloadPolicyPanelProps {
  fileId: string | null | undefined;
  blockId: string | null | undefined;
  blockType: EditorMediaBlockType | null | undefined;
}

export function useEditorMediaDownloadPolicyRuntimeTarget(): MediaDownloadPolicyRuntimeTarget | null {
  const runtimeContext = useOptionalEditorRuntimeContext();
  return runtimeContext?.entityId.trim() && runtimeContext.entityType === 'post'
    ? {
        entityType: TranscodeEntityType.POST,
        entityId: runtimeContext.entityId.trim(),
      }
    : runtimeContext?.entityId.trim() && runtimeContext.entityType === 'page'
      ? {
          entityType: TranscodeEntityType.PAGE,
          entityId: runtimeContext.entityId.trim(),
        }
      : runtimeContext?.entityId.trim() && runtimeContext.entityType === 'work'
        ? {
            entityType: TranscodeEntityType.WORK,
            entityId: runtimeContext.entityId.trim(),
          }
        : runtimeContext?.entityId.trim() && runtimeContext.entityType === 'program_event'
          ? {
              entityType: TranscodeEntityType.PROGRAM_EVENT,
              entityId: runtimeContext.entityId.trim(),
            }
          : null;
}

export function ConnectedMediaDownloadPolicyPanel(props: ConnectedMediaDownloadPolicyPanelProps) {
  const adapter = useConnectedMediaDownloadPolicyAdapter();
  const runtimeTarget = useEditorMediaDownloadPolicyRuntimeTarget();
  return <MediaDownloadPolicyPanel {...props} runtimeTarget={runtimeTarget} adapter={adapter} />;
}
