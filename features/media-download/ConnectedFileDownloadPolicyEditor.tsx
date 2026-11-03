'use client';

import {
  getFileDownloadPolicyAction,
  listMemberCriteriaForAuthenticatedAccessAction,
  updateFileDownloadPolicyAction,
} from '@/lib/actions/file-download-access';
import type { FileDownloadPolicyTarget } from '@/lib/types/file-download-access';
import { FileDownloadPolicyEditor, type FileDownloadPolicyEditorAdapter } from './FileDownloadPolicyEditor';

const connectedAdapter: FileDownloadPolicyEditorAdapter = {
  loadPolicy: getFileDownloadPolicyAction,
  loadCriteriaList: listMemberCriteriaForAuthenticatedAccessAction,
  savePolicy: updateFileDownloadPolicyAction,
};

interface ConnectedFileDownloadPolicyEditorProps extends FileDownloadPolicyTarget {
  releaseId?: string;
  compact?: boolean;
  readOnly?: boolean;
}

export function ConnectedFileDownloadPolicyEditor(props: ConnectedFileDownloadPolicyEditorProps) {
  return <FileDownloadPolicyEditor {...props} adapter={connectedAdapter} />;
}
