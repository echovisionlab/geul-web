import { mediaContainerStyleToReact, resolveMediaContainerStyle, getBlockPropString } from '@/lib/media/shared';
import type { Block } from '@/lib/types/page-content';
import type { useContentMediaDelivery } from '@/features/media/ContentMediaDeliveryContext';

export function getContainerStyle(block: Block): React.CSSProperties {
  return (
    mediaContainerStyleToReact(
      resolveMediaContainerStyle(
        getBlockPropString(block.props, 'previewWidth', '100'),
        getBlockPropString(block.props, 'textAlignment', 'left'),
      ),
    ) || {}
  );
}

export async function resolveShaderMediaAsset(
  mediaDelivery: ReturnType<typeof useContentMediaDelivery>,
  fileId: string,
  kind: 'image' | 'video',
) {
  if (!mediaDelivery) {
    throw new Error('Shader media delivery is unavailable.');
  }
  const url = await mediaDelivery.resolveAsset(fileId, kind);
  if (!url?.trim()) {
    throw new Error(`Shader ${kind} file is unavailable.`);
  }
  return { fileId, kind, url } as const;
}
