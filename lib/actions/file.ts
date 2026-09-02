'use server';

import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import type { Timestamp } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { MediaProcessingStatus, type MediaDelivery } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import {
  FileManagerSortField,
  FileDerivativeType,
  FileUsageDomain,
  UploadType,
  type FileManagerFile as FileManagerFileMessage,
} from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { createFileClient } from '@/lib/api/server-client';
import {
  fetchMediaDeliveryBatches,
  mergeRecordBatches,
  uniqueMediaIdsInOrder,
} from '@/lib/media/media-delivery-batches';
import type { EditorFileStatusSnapshot } from '@/lib/media/editor-file-status-runtime';
import { UPLOAD_FAILED_MESSAGE } from '@/lib/upload/failure';

function normalizeDefinitiveUploadCompletionError(err: unknown, options: { candidateLookup: boolean }): Error | null {
  if (!isConnectError(err)) {
    return null;
  }
  if (err.code === Code.Unauthenticated) {
    return new Error('Unauthorized');
  }
  if (err.code === Code.PermissionDenied) {
    return new Error('Forbidden');
  }

  const definitiveCodes = options.candidateLookup
    ? [Code.InvalidArgument, Code.NotFound, Code.FailedPrecondition]
    : [Code.InvalidArgument, Code.NotFound];
  return definitiveCodes.includes(err.code) ? new Error(UPLOAD_FAILED_MESSAGE) : null;
}

function timestampToDate(value: Timestamp | undefined): Date | null {
  if (!value) {
    return null;
  }
  const seconds = typeof value.seconds === 'bigint' ? Number(value.seconds) : Number(value.seconds || 0);
  return new Date(seconds * 1000 + Math.floor((value.nanos || 0) / 1_000_000));
}

function hasDeliveryUrl(delivery: MediaDelivery | undefined): boolean {
  return Boolean(delivery?.asset?.url || delivery?.inline?.url || delivery?.download?.url || delivery?.playback?.url);
}

function fileStatusFromDelivery(delivery: MediaDelivery | undefined): EditorFileStatusSnapshot {
  const mimeType = (delivery?.mimeType || '').toLowerCase();
  const hasBackendProcessingLifecycle = mimeType.startsWith('video/') || mimeType.startsWith('audio/');
  const completed = hasBackendProcessingLifecycle
    ? delivery?.processingStatus === MediaProcessingStatus.READY
    : hasDeliveryUrl(delivery);

  return {
    mimeType,
    completed,
    failed: !completed && delivery?.processingStatus === MediaProcessingStatus.FAILED,
    unavailable: false,
    url: delivery?.asset?.url || delivery?.inline?.url || '',
    originalUrl: delivery?.download?.url || delivery?.inline?.url || delivery?.asset?.url || '',
    waveformUrl: delivery?.waveform?.url || '',
    spectrogramUrl: delivery?.spectrogram?.url || '',
    thumbnailUrl: delivery?.thumbnail?.url || '',
    hlsUrl: delivery?.playback?.url || '',
    durationSeconds: delivery?.durationSeconds || 0,
    processingStatus: delivery?.processingStatus ?? MediaProcessingStatus.UNSPECIFIED,
    processingPercentage: delivery?.processingPercentage,
  };
}

function missingFileStatus(): EditorFileStatusSnapshot {
  return {
    ...fileStatusFromDelivery(undefined),
    failed: true,
    processingStatus: MediaProcessingStatus.FAILED,
  };
}

function unavailableFileStatus(): EditorFileStatusSnapshot {
  return {
    ...fileStatusFromDelivery(undefined),
    unavailable: true,
  };
}

function uploadDeliveryUrl(delivery: MediaDelivery | undefined, uploadType: UploadType): string {
  if (uploadType === UploadType.EDITOR_ATTACHMENT) {
    return delivery?.asset?.url || delivery?.download?.url || delivery?.inline?.url || '';
  }
  if (uploadType === UploadType.EDITOR_AUDIO || uploadType === UploadType.EDITOR_VIDEO) {
    return delivery?.playback?.url || delivery?.inline?.url || delivery?.download?.url || '';
  }
  return delivery?.asset?.url || delivery?.inline?.url || delivery?.playback?.url || delivery?.download?.url || '';
}

export async function initiateUploadAction(input: {
  uploadType: UploadType;
  entityId?: string;
  fileSize: number;
  mimeType: string;
  fileName: string;
  fileLastModified?: number;
  slotId?: string;
  entityType?: TranscodeEntityType;
  expectedCurrentFileId?: string;
}) {
  try {
    const client = await createFileClient();
    const response = await client.initiateMultipartUpload({
      uploadType: input.uploadType,
      entityId: input.entityId ?? '',
      fileSize: BigInt(input.fileSize),
      mimeType: input.mimeType,
      fileName: input.fileName,
      fileLastModified: input.fileLastModified == null ? undefined : BigInt(input.fileLastModified),
      slotId: input.slotId?.trim() || undefined,
      entityType: input.entityType,
      expectedCurrentFileId: input.expectedCurrentFileId || undefined,
    });

    return {
      uploadId: response.uploadId,
      fileId: response.fileId,
      extension: response.extension,
      totalParts: response.totalParts,
      chunkSize: response.chunkSize,
      uploadedParts: response.uploadedParts.map((part) => ({
        partNumber: part.partNumber,
        etag: part.etag,
      })),
      status: response.status,
      resumed: response.resumed,
      slotId: response.slotId || '',
      attemptId: response.ingestAttemptId || '',
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      throw new Error('Unauthorized');
    }
    throw err;
  }
}

export async function findMultipartUploadCandidateAction(input: {
  uploadType: UploadType;
  entityId: string;
  entityType?: TranscodeEntityType;
  slotId?: string;
  expectedCurrentFileId?: string;
  fileId: string;
  uploadId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileLastModified?: number;
}) {
  try {
    const client = await createFileClient();
    const response = await client.findMultipartUploadCandidate({
      uploadType: input.uploadType,
      entityId: input.entityId,
      entityType: input.entityType,
      slotId: input.slotId?.trim() || undefined,
      expectedCurrentFileId: input.expectedCurrentFileId || undefined,
      fileId: input.fileId,
      uploadId: input.uploadId,
      fileName: input.fileName,
      fileSize: input.fileSize == null ? undefined : BigInt(input.fileSize),
      mimeType: input.mimeType,
      fileLastModified: input.fileLastModified == null ? undefined : BigInt(input.fileLastModified),
    });

    if (!response.uploadId) {
      return null;
    }

    return {
      uploadId: response.uploadId,
      fileId: response.fileId || '',
      extension: response.extension || '',
      totalParts: response.totalParts,
      chunkSize: response.chunkSize,
      uploadedParts: response.uploadedParts.map((part) => ({
        partNumber: part.partNumber,
        etag: part.etag,
      })),
      status: response.status,
      fileName: response.fileName || '',
      fileSize: Number(response.fileSize || 0),
      mimeType: response.mimeType || '',
      fileLastModified: response.fileLastModified == null ? undefined : Number(response.fileLastModified),
      lastActivityAt: timestampToDate(response.lastActivityAt),
      slotId: response.slotId || '',
      attemptId: response.ingestAttemptId || '',
    };
  } catch (err) {
    const definitiveError = normalizeDefinitiveUploadCompletionError(err, { candidateLookup: true });
    if (definitiveError) {
      throw definitiveError;
    }
    throw err;
  }
}

export async function completeUploadAction(input: {
  fileId: string;
  uploadId: string;
  uploadType: UploadType;
  correlationId?: string;
}) {
  try {
    const client = await createFileClient();
    const response = await client.completeMultipartUpload({
      fileId: input.fileId,
      uploadId: input.uploadId,
      correlationId: input.correlationId,
    });

    return { url: uploadDeliveryUrl(response.delivery, input.uploadType), fileId: response.fileId };
  } catch (err) {
    const definitiveError = normalizeDefinitiveUploadCompletionError(err, { candidateLookup: false });
    if (definitiveError) {
      throw definitiveError;
    }
    throw err;
  }
}

export async function recoverCompletedUploadAction(input: Parameters<typeof completeUploadAction>[0]) {
  try {
    return await completeUploadAction(input);
  } catch (err) {
    const definitiveError = normalizeDefinitiveUploadCompletionError(err, { candidateLookup: true });
    if (definitiveError) {
      throw definitiveError;
    }
    throw err;
  }
}

export async function abortUploadAction(input: { fileId: string; uploadId: string; correlationId?: string }) {
  try {
    const client = await createFileClient();
    await client.abortMultipartUpload({
      fileId: input.fileId,
      uploadId: input.uploadId,
      correlationId: input.correlationId,
    });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      throw new Error('Unauthorized');
    }
    throw err;
  }
}

export async function deleteFileAction(fileId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createFileClient();
    await client.deleteFile({ fileId });
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.NotFound) {
        return { success: true };
      }
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return {
      error: err instanceof Error ? err.message : 'Failed to delete file',
    };
  }
}

export interface FileManagerMemberSummary {
  id: string;
  nickname: string;
  deleted: boolean;
}

export interface FileManagerPathSegment {
  id: string;
  name: string;
}

export interface FileManagerFolderRow {
  kind: 'folder';
  id: string;
  parentId?: string;
  name: string;
  createdByMember?: FileManagerMemberSummary;
  createdAt: string | null;
  updatedAt: string | null;
  folderPath?: FileManagerPathSegment[];
}

export interface FileManagerFileRow {
  kind: 'file';
  id: string;
  folderId?: string;
  fileName: string;
  extension: string;
  mimeType: string;
  fileSize: number;
  durationSeconds?: number;
  uploadedByMember?: FileManagerMemberSummary;
  createdAt: string | null;
  updatedAt: string | null;
  usageCount: number;
  inlineUrl?: string;
  downloadUrl?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  waveformUrl?: string;
  processingStatus?: MediaProcessingStatus;
  generatedOutputs?: FileManagerGeneratedOutputView[];
  folderPath?: FileManagerPathSegment[];
}

export interface FileManagerGeneratedOutputView {
  id: string;
  type: FileDerivativeType;
  status: MediaProcessingStatus;
  url?: string;
}

export type FileManagerRow = FileManagerFolderRow | FileManagerFileRow;

export interface FileManagerUsageView {
  domain: FileUsageDomain;
  entityId: string;
  slot: string;
  blockId?: string;
  blockType?: string;
  title?: string;
  link?: string;
  count: number;
}

export interface FileDeletionImpactView {
  fileId: string;
  totalUsageCount: number;
  domainCounts: { domain: FileUsageDomain; count: number }[];
  firstUsages: FileManagerUsageView[];
  hasMoreUsages: boolean;
}

export type FileManagerActionErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'fileNotFound'
  | 'loadFile'
  | 'loadUsages'
  | 'createFolder'
  | 'renameFolder'
  | 'moveFolder'
  | 'deleteFolder'
  | 'renameFile'
  | 'moveFiles'
  | 'inspectUsage'
  | 'deleteFiles';

function fileManagerMemberSummary(
  member: { id: string; nickname: string; deleted: boolean } | undefined,
): FileManagerMemberSummary | undefined {
  return member ? { id: member.id, nickname: member.nickname, deleted: member.deleted } : undefined;
}

function fileManagerFileRow(
  file: FileManagerFileMessage,
  folderPath: FileManagerPathSegment[] = [],
): FileManagerFileRow {
  return {
    kind: 'file',
    id: file.id,
    folderId: file.folderId,
    fileName: file.fileName,
    extension: file.extension,
    mimeType: file.mimeType,
    fileSize: Number(file.fileSize),
    durationSeconds: file.durationSeconds,
    uploadedByMember: fileManagerMemberSummary(file.uploadedByMember),
    createdAt: fileManagerTimestamp(file.createdAt),
    updatedAt: fileManagerTimestamp(file.updatedAt),
    usageCount: file.usageCount,
    inlineUrl: file.delivery?.inline?.url,
    downloadUrl: file.delivery?.download?.url,
    playbackUrl: file.delivery?.playback?.url,
    thumbnailUrl: file.delivery?.thumbnail?.url,
    waveformUrl: file.delivery?.waveform?.url,
    processingStatus: file.delivery?.processingStatus,
    folderPath,
  };
}

function fileManagerFolderPath(item: unknown): FileManagerPathSegment[] {
  const folderPath = (item as { folderPath?: { id: string; name: string }[] }).folderPath;
  return (folderPath ?? []).map((segment) => ({ id: segment.id, name: segment.name }));
}

function fileManagerItemRow(item: unknown): FileManagerRow | null {
  const message = item as { item?: { case?: string; value?: unknown } };
  const folderPath = fileManagerFolderPath(item);
  if (message.item?.case === 'folder') {
    const folder = message.item.value as {
      id: string;
      parentId?: string;
      name: string;
      createdByMember?: Parameters<typeof fileManagerMemberSummary>[0];
      createdAt?: Timestamp;
      updatedAt?: Timestamp;
    };
    return {
      kind: 'folder',
      id: folder.id,
      parentId: folder.parentId,
      name: folder.name,
      createdByMember: fileManagerMemberSummary(folder.createdByMember),
      createdAt: fileManagerTimestamp(folder.createdAt),
      updatedAt: fileManagerTimestamp(folder.updatedAt),
      folderPath,
    };
  }
  if (message.item?.case === 'file') {
    return fileManagerFileRow(message.item.value as FileManagerFileMessage, folderPath);
  }
  return null;
}

function fileManagerTimestamp(value: Timestamp | undefined): string | null {
  return timestampToDate(value)?.toISOString() ?? null;
}

function fileManagerUsageView(usage: {
  domain: FileUsageDomain;
  entityId: string;
  referencePath: string;
  blockId?: string;
  blockType?: string;
  title?: string;
  link?: string;
  count: number;
}): FileManagerUsageView {
  return {
    domain: usage.domain,
    entityId: usage.entityId,
    slot: usage.referencePath,
    blockId: usage.blockId,
    blockType: usage.blockType,
    title: usage.title,
    link: usage.link,
    count: usage.count,
  };
}

function fileDeletionImpactView(impact: {
  fileId: string;
  totalUsageCount: bigint;
  domainCounts: { domain: FileUsageDomain; count: bigint }[];
  firstUsages: Parameters<typeof fileManagerUsageView>[0][];
  hasMoreUsages: boolean;
}): FileDeletionImpactView {
  return {
    fileId: impact.fileId,
    totalUsageCount: Number(impact.totalUsageCount),
    domainCounts: impact.domainCounts.map((entry) => ({ domain: entry.domain, count: Number(entry.count) })),
    firstUsages: impact.firstUsages.map(fileManagerUsageView),
    hasMoreUsages: impact.hasMoreUsages,
  };
}

function fileManagerActionErrorCode(error: unknown, fallback: FileManagerActionErrorCode): FileManagerActionErrorCode {
  if (isConnectError(error)) {
    if (error.code === Code.Unauthenticated) {
      return 'unauthorized';
    }
    if (error.code === Code.PermissionDenied) {
      return 'forbidden';
    }
  }
  return fallback;
}

export async function listFileManagerItemsAction(input: {
  folderId?: string;
  query?: string;
  mimeTypePrefix?: string;
  uploadedByMemberId?: string;
  sortField?: FileManagerSortField;
  sortOrder?: 'asc' | 'desc';
}): Promise<{ items: FileManagerRow[]; total: number; folderNotFound: boolean }> {
  const client = await createFileClient();
  const directoryLimit = 10_000;
  const items: FileManagerRow[] = [];
  let response;
  try {
    response = await client.listFileManagerItems({
      folderId: input.folderId,
      query: input.query || undefined,
      mimeTypePrefix: input.mimeTypePrefix || undefined,
      uploadedByMemberId: input.uploadedByMemberId || undefined,
      sortField: input.sortField ?? FileManagerSortField.NAME,
      sortOrder: input.sortOrder === 'desc' ? SortOrder.DESC : SortOrder.ASC,
      pageSize: directoryLimit,
    });
  } catch (error) {
    if (isConnectErrorCode(error, Code.NotFound) && input.folderId) {
      return { items: [], total: 0, folderNotFound: true };
    }
    throw error;
  }

  if (response.total < BigInt(0) || response.total > BigInt(directoryLimit) || response.nextPageToken) {
    throw new Error(`File Manager directories are limited to ${directoryLimit} items`);
  }
  const total = Number(response.total);
  const seenItemIds = new Set<string>();
  for (const item of response.items) {
    const row = fileManagerItemRow(item);
    if (!row) {
      continue;
    }
    if (seenItemIds.has(row.id)) {
      throw new Error('File Manager returned a duplicate item');
    }
    seenItemIds.add(row.id);
    items.push(row);
  }
  if (items.length !== total) {
    throw new Error('File Manager returned an incomplete directory');
  }

  return { items, total, folderNotFound: false };
}

export async function searchFileManagerItemsAction(input: {
  query: string;
  folderId?: string;
  mimeTypePrefix?: string;
  uploadedByMemberId?: string;
  sortField?: FileManagerSortField;
  sortOrder?: 'asc' | 'desc';
  pageToken?: string;
  pageSize?: number;
}): Promise<{ items: FileManagerRow[]; total: number; nextPageToken?: string }> {
  const query = input.query.trim();
  if (!query) {
    throw new Error('File Manager search requires a query');
  }
  const response = await (
    await createFileClient()
  ).listFileManagerItems({
    query,
    ...(input.folderId ? { folderId: input.folderId } : {}),
    mimeTypePrefix: input.mimeTypePrefix || undefined,
    uploadedByMemberId: input.uploadedByMemberId || undefined,
    sortField: input.sortField ?? FileManagerSortField.NAME,
    sortOrder: input.sortOrder === 'desc' ? SortOrder.DESC : SortOrder.ASC,
    pageSize: Math.min(100, Math.max(1, input.pageSize ?? 50)),
    pageToken: input.pageToken,
  });
  if (response.total < BigInt(0) || response.total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('File Manager returned an invalid search total');
  }
  const seenItemIds = new Set<string>();
  const items: FileManagerRow[] = [];
  for (const item of response.items) {
    const row = fileManagerItemRow(item);
    if (!row) {
      continue;
    }
    if (seenItemIds.has(row.id)) {
      throw new Error('File Manager returned a duplicate search item');
    }
    seenItemIds.add(row.id);
    items.push(row);
  }
  return { items, total: Number(response.total), nextPageToken: response.nextPageToken };
}

export async function getManagedFileAction(fileId: string) {
  try {
    const response = await (await createFileClient()).getFile({ fileId });
    if (!response.file) {
      return { success: false as const, errorCode: 'fileNotFound' as const };
    }
    return {
      success: true as const,
      file: {
        ...fileManagerFileRow(response.file),
        generatedOutputs: (response.generatedOutputs ?? []).map((output) => ({
          id: output.id,
          type: output.type,
          status: output.status,
          url:
            output.delivery?.asset?.url ??
            output.delivery?.playback?.url ??
            output.delivery?.inline?.url ??
            output.delivery?.download?.url,
        })),
      },
      domainUsageSummary: response.domainUsageSummary.map(fileManagerUsageView),
    };
  } catch (error) {
    return { success: false as const, errorCode: fileManagerActionErrorCode(error, 'loadFile') };
  }
}

export async function listManagedFileUsagesAction(input: { fileId: string; pageSize?: number; pageToken?: string }) {
  try {
    const response = await (
      await createFileClient()
    ).listFileUsages({
      fileId: input.fileId,
      pageSize: input.pageSize ?? 25,
      pageToken: input.pageToken,
    });
    return {
      success: true as const,
      usages: response.usages.map(fileManagerUsageView),
      nextPageToken: response.nextPageToken,
      total: Number(response.total),
    };
  } catch (error) {
    return { success: false as const, errorCode: fileManagerActionErrorCode(error, 'loadUsages') };
  }
}

export async function createFileFolderAction(input: { parentId?: string; name: string }) {
  try {
    const response = await (await createFileClient()).createFileFolder(input);
    return { success: true as const, folderId: response.folder?.id };
  } catch (error) {
    return { success: false as const, errorCode: fileManagerActionErrorCode(error, 'createFolder') };
  }
}

export async function renameFileFolderAction(input: { folderId: string; name: string }) {
  try {
    await (await createFileClient()).renameFileFolder(input);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, errorCode: fileManagerActionErrorCode(error, 'renameFolder') };
  }
}

export async function moveFileFolderAction(input: { folderId: string; parentId?: string }) {
  try {
    await (await createFileClient()).moveFileFolder(input);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, errorCode: fileManagerActionErrorCode(error, 'moveFolder') };
  }
}

export async function deleteFileFolderAction(folderId: string) {
  try {
    const response = await (await createFileClient()).deleteFileFolder({ folderId });
    return { success: true as const, acceptedFileIds: response.acceptedFileIds };
  } catch (error) {
    return { success: false as const, errorCode: fileManagerActionErrorCode(error, 'deleteFolder') };
  }
}

export async function renameManagedFileAction(input: { fileId: string; fileName: string }) {
  try {
    await (await createFileClient()).renameFile(input);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, errorCode: fileManagerActionErrorCode(error, 'renameFile') };
  }
}

export async function moveManagedFilesAction(input: { fileIds: string[]; folderId?: string }) {
  try {
    await (await createFileClient()).moveFiles(input);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, errorCode: fileManagerActionErrorCode(error, 'moveFiles') };
  }
}

export async function getFileDeletionImpactAction(fileIds: string[]) {
  try {
    const response = await (await createFileClient()).getFileDeletionImpact({ fileIds });
    return { success: true as const, impacts: response.impacts.map(fileDeletionImpactView) };
  } catch (error) {
    return { success: false as const, errorCode: fileManagerActionErrorCode(error, 'inspectUsage') };
  }
}

export async function deleteManagedFilesAction(fileIds: string[]) {
  try {
    const response = await (await createFileClient()).deleteFiles({ fileIds });
    return {
      success: true as const,
      acceptedFileIds: response.acceptedFileIds,
      rejectedFiles: response.rejectedFiles.map(fileDeletionImpactView),
    };
  } catch (error) {
    return { success: false as const, errorCode: fileManagerActionErrorCode(error, 'deleteFiles') };
  }
}

export async function downloadFromUrlAction(input: {
  uploadType: UploadType;
  entityId: string;
  entityType?: TranscodeEntityType;
  url: string;
  correlationId?: string;
  slotId?: string;
  expectedCurrentFileId?: string;
}) {
  try {
    const client = await createFileClient();
    const response = await client.downloadFromUrl({
      uploadType: input.uploadType,
      entityId: input.entityId,
      entityType: input.entityType,
      url: input.url,
      correlationId: input.correlationId,
      slotId: input.slotId?.trim() || undefined,
      expectedCurrentFileId: input.expectedCurrentFileId || undefined,
    });

    return {
      url: uploadDeliveryUrl(response.delivery, input.uploadType),
      fileId: response.fileId,
      slotId: response.slotId || '',
      attemptId: response.ingestAttemptId || '',
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      throw new Error('Unauthorized');
    }
    throw err;
  }
}

export async function getFileStatusAction(fileId: string): Promise<EditorFileStatusSnapshot> {
  try {
    const client = await createFileClient();
    const response = await client.getMediaDelivery({ fileId });
    return fileStatusFromDelivery(response.delivery);
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return missingFileStatus();
    }

    // Transport or upstream errors should not be mistaken for terminal processing failure.
    return unavailableFileStatus();
  }
}

export async function getFileStatusesAction(fileIds: string[]): Promise<Record<string, EditorFileStatusSnapshot>> {
  const uniqueFileIds = uniqueMediaIdsInOrder(fileIds);
  if (uniqueFileIds.length === 0) {
    return {};
  }

  try {
    const client = await createFileClient();
    const responses = await fetchMediaDeliveryBatches(uniqueFileIds, (batch) =>
      client.getBulkMediaDeliveries({ fileIds: batch }),
    );
    const files = mergeRecordBatches(responses.map((response) => response.files));

    return Object.fromEntries(
      uniqueFileIds.map((fileId) => {
        const entry = files[fileId];
        return [fileId, entry ? fileStatusFromDelivery(entry.delivery) : missingFileStatus()];
      }),
    );
  } catch {
    // A batch transport failure is transient for every requested file.
    return Object.fromEntries(uniqueFileIds.map((fileId) => [fileId, unavailableFileStatus()]));
  }
}
