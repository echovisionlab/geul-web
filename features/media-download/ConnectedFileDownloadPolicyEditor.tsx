'use client';

import {
  getFileDownloadPolicyAction,
  listAudienceSegmentsForAuthenticatedAccessAction,
  updateFileDownloadPolicyAction,
} from '@/lib/actions/file-download-access';
import type { FileDownloadPolicyTarget } from '@/lib/types/file-download-access';
import { FileDownloadPolicyEditor, type FileDownloadPolicyEditorAdapter } from './FileDownloadPolicyEditor';

const connectedAdapter: FileDownloadPolicyEditorAdapter = {
  loadPolicy: getFileDownloadPolicyAction,
  loadSegments: listAudienceSegmentsForAuthenticatedAccessAction,
  savePolicy: updateFileDownloadPolicyAction,
};

interface ConnectedFileDownloadPolicyEditorProps extends FileDownloadPolicyTarget {
  compact?: boolean;
}

export function ConnectedFileDownloadPolicyEditor(props: ConnectedFileDownloadPolicyEditorProps) {
  return <FileDownloadPolicyEditor {...props} adapter={connectedAdapter} />;
}
