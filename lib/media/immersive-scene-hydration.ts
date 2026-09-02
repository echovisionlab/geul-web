import type { MediaDelivery } from '@echovisionlab/geul-proto/common/media_pb.ts';

export type ImmersiveSceneMediaDeliveryMap = Record<string, MediaDelivery>;

export interface ImmersiveSceneMediaRequest {
  fileId: string;
  includeDownloadUrl: boolean;
}

export interface ImmersiveSceneHydrationOptions {
  mode: 'public' | 'authenticated';
  includeSourceWhenOptimized?: boolean;
  allowSignedPreviewFallback?: boolean;
}

interface ImmersiveSceneAssetField {
  fileIdField: string;
  urlField: string;
  fileNameField: string;
  fileSizeField: string;
  kind: 'mesh' | 'texture';
}

const meshAssetField: ImmersiveSceneAssetField = {
  fileIdField: 'meshFileId',
  urlField: 'meshUrl',
  fileNameField: 'meshFileName',
  fileSizeField: 'meshFileSize',
  kind: 'mesh',
};

const optimizedMeshAssetField: ImmersiveSceneAssetField = {
  fileIdField: 'meshOptimizationFileId',
  urlField: 'meshOptimizationUrl',
  fileNameField: 'meshOptimizationFileName',
  fileSizeField: 'meshOptimizationFileSize',
  kind: 'mesh',
};

const textureAssetField: ImmersiveSceneAssetField = {
  fileIdField: 'textureFileId',
  urlField: 'textureUrl',
  fileNameField: 'textureFileName',
  fileSizeField: 'textureFileSize',
  kind: 'texture',
};

const darkTextureAssetField: ImmersiveSceneAssetField = {
  fileIdField: 'darkTextureFileId',
  urlField: 'darkTextureUrl',
  fileNameField: 'darkTextureFileName',
  fileSizeField: 'darkTextureFileSize',
  kind: 'texture',
};

const immersiveSceneAssetFields = [
  meshAssetField,
  optimizedMeshAssetField,
  textureAssetField,
  darkTextureAssetField,
] as const;

function normalizedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseImmersiveSceneUnitsJson(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => {
      return typeof item === 'object' && item !== null && !Array.isArray(item);
    });
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  try {
    return parseImmersiveSceneUnitsJson(JSON.parse(value) as unknown);
  } catch {
    return [];
  }
}

function collectRecordRequests(
  record: Record<string, unknown>,
  requests: Map<string, ImmersiveSceneMediaRequest>,
  includeSourceWhenOptimized: boolean,
  allowSignedPreviewFallback: boolean,
) {
  const optimizedFileId = normalizedString(record[optimizedMeshAssetField.fileIdField]);
  const fields = [
    ...(includeSourceWhenOptimized || !optimizedFileId ? [meshAssetField] : []),
    ...(optimizedFileId ? [optimizedMeshAssetField] : []),
    textureAssetField,
    darkTextureAssetField,
  ];

  for (const field of fields) {
    const fileId = normalizedString(record[field.fileIdField]);
    if (!fileId) {
      continue;
    }
    requests.set(fileId, {
      fileId,
      includeDownloadUrl: field.kind === 'mesh' && allowSignedPreviewFallback,
    });
  }
}

export function collectImmersiveSceneMediaRequests(
  props: Record<string, unknown> | undefined,
  options: Pick<ImmersiveSceneHydrationOptions, 'includeSourceWhenOptimized' | 'allowSignedPreviewFallback'> = {},
): ImmersiveSceneMediaRequest[] {
  if (!props) {
    return [];
  }

  const requests = new Map<string, ImmersiveSceneMediaRequest>();
  const includeSourceWhenOptimized = options.includeSourceWhenOptimized ?? false;
  const allowSignedPreviewFallback = options.allowSignedPreviewFallback ?? false;
  collectRecordRequests(props, requests, includeSourceWhenOptimized, allowSignedPreviewFallback);
  for (const unit of parseImmersiveSceneUnitsJson(props.unitsJson)) {
    collectRecordRequests(unit, requests, includeSourceWhenOptimized, allowSignedPreviewFallback);
  }
  return [...requests.values()];
}

function resolveDeliveryUrl(
  field: ImmersiveSceneAssetField,
  delivery: MediaDelivery | undefined,
  options: ImmersiveSceneHydrationOptions,
): string {
  if (!delivery) {
    return '';
  }

  const immutableUrl = field.kind === 'texture' ? delivery.thumbnail?.url || delivery.asset?.url : delivery.asset?.url;
  if (immutableUrl) {
    return immutableUrl;
  }
  if (options.mode === 'authenticated') {
    return delivery.inline?.url || delivery.download?.url || '';
  }
  if (options.allowSignedPreviewFallback) {
    return field.kind === 'mesh' ? delivery.download?.url || delivery.inline?.url || '' : delivery.inline?.url || '';
  }
  return '';
}

function resolveDeliveryFileName(delivery: MediaDelivery): string {
  return (
    delivery.fileName ||
    delivery.asset?.downloadFilename ||
    delivery.inline?.fileName ||
    delivery.download?.fileName ||
    ''
  );
}

function hydrateRecord(
  record: Record<string, unknown>,
  mediaByFileId: ImmersiveSceneMediaDeliveryMap,
  options: ImmersiveSceneHydrationOptions,
): Record<string, unknown> {
  const nextRecord = { ...record };
  const optimizedFileId = normalizedString(record[optimizedMeshAssetField.fileIdField]);

  for (const field of immersiveSceneAssetFields) {
    const fileId = normalizedString(record[field.fileIdField]);
    const sourceSuppressed =
      field === meshAssetField && Boolean(optimizedFileId) && !options.includeSourceWhenOptimized;
    const delivery = !sourceSuppressed && fileId ? mediaByFileId[fileId] : undefined;
    const url = resolveDeliveryUrl(field, delivery, options);

    if (url) {
      nextRecord[field.urlField] = url;
    } else {
      delete nextRecord[field.urlField];
    }

    if (options.mode !== 'authenticated') {
      delete nextRecord[field.fileNameField];
      delete nextRecord[field.fileSizeField];
      continue;
    }

    const fileName = delivery ? resolveDeliveryFileName(delivery) : '';
    if (fileName) {
      nextRecord[field.fileNameField] = fileName;
    } else {
      delete nextRecord[field.fileNameField];
    }

    const fileSize = delivery && delivery.fileSize > BigInt(0) ? String(delivery.fileSize) : '';
    if (fileSize) {
      nextRecord[field.fileSizeField] = fileSize;
    } else {
      delete nextRecord[field.fileSizeField];
    }
  }

  return nextRecord;
}

export function hydrateImmersiveSceneAssetProps(
  props: Record<string, unknown>,
  mediaByFileId: ImmersiveSceneMediaDeliveryMap,
  options: ImmersiveSceneHydrationOptions,
): Record<string, unknown> {
  const nextProps = hydrateRecord(props, mediaByFileId, options);
  const units = parseImmersiveSceneUnitsJson(props.unitsJson);
  if (units.length > 0) {
    nextProps.unitsJson = JSON.stringify(units.map((unit) => hydrateRecord(unit, mediaByFileId, options)));
  }
  return nextProps;
}
