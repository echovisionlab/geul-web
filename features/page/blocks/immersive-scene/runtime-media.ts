import type { MediaDelivery } from '@echovisionlab/geul-proto/common/media_pb.ts';
import type { ContentBlockMediaRuntimeIndex } from '@/features/media/content-block-media-runtime';
import { hydrateImmersiveSceneAssetProps, parseImmersiveSceneUnitsJson } from '@/lib/media/immersive-scene-hydration';

interface RuntimeAssetField {
  fileIdField: string;
  role: 'mesh' | 'optimized_mesh' | 'texture' | 'dark_texture';
}

const sourceMeshField: RuntimeAssetField = {
  fileIdField: 'meshFileId',
  role: 'mesh',
};

const optimizedMeshField: RuntimeAssetField = {
  fileIdField: 'meshOptimizationFileId',
  role: 'optimized_mesh',
};

const textureFields: RuntimeAssetField[] = [
  { fileIdField: 'textureFileId', role: 'texture' },
  { fileIdField: 'darkTextureFileId', role: 'dark_texture' },
];

function normalizedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function selectedRuntimeAssetFields(unit: Record<string, unknown>): RuntimeAssetField[] {
  return [
    normalizedString(unit[optimizedMeshField.fileIdField]) ? optimizedMeshField : sourceMeshField,
    ...textureFields,
  ];
}

export function hydrateImmersiveSceneRuntimeProps(
  props: Record<string, unknown>,
  sectionId: string | undefined,
  runtime: ContentBlockMediaRuntimeIndex | null,
): Record<string, unknown> {
  const units = parseImmersiveSceneUnitsJson(props.unitsJson);
  const requests = units.flatMap((unit) => {
    const unitId = normalizedString(unit.id);
    return selectedRuntimeAssetFields(unit).flatMap((field) => {
      const fileId = normalizedString(unit[field.fileIdField]);
      return unitId && fileId ? [{ field, fileId, unitId }] : [];
    });
  });

  if (requests.length === 0) {
    return props;
  }
  if (!sectionId) {
    throw new Error('Immersive Scene runtime media requires a section identity.');
  }
  if (!runtime) {
    throw new Error(`Immersive Scene ${sectionId} requires Content Block media runtime context.`);
  }

  const mediaByFileId: Record<string, MediaDelivery> = {};
  for (const { field, fileId, unitId } of requests) {
    const referencePath = `immersive_scene:${unitId}:${field.role}`;
    const item = runtime.get(sectionId, referencePath);
    const attachment = item?.attachment?.state;
    if (!attachment || attachment.case !== 'activeFileId') {
      throw new Error(`Immersive Scene ${sectionId} has no active runtime attachment for ${referencePath}.`);
    }
    if (attachment.value !== fileId) {
      throw new Error(
        `Immersive Scene ${sectionId} runtime attachment does not match durable state for ${referencePath}.`,
      );
    }
    if (item.delivery) {
      mediaByFileId[fileId] = item.delivery;
    }
  }

  return hydrateImmersiveSceneAssetProps(props, mediaByFileId, { mode: 'public' });
}
