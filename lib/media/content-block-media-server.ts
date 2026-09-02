import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';

export function activeContentBlockFileId(item: ContentBlockMediaItem): string | null {
  return item.attachment?.state.case === 'activeFileId' ? item.attachment.state.value : null;
}

export function findContentBlockMediaBySelector(
  items: readonly ContentBlockMediaItem[],
  selector: { blockId: string; referencePath: string },
): ContentBlockMediaItem | null {
  return (
    items.find(
      (item) => item.selector?.blockId === selector.blockId && item.selector.referencePath === selector.referencePath,
    ) ?? null
  );
}

export function contentBlockMediaAssetRecord(item: ContentBlockMediaItem): Record<string, string> {
  const delivery = item.delivery;
  return {
    fileId: activeContentBlockFileId(item) ?? '',
    imageUrl: delivery?.asset?.url ?? delivery?.inline?.url ?? '',
    hlsUrl: delivery?.playback?.url ?? '',
    waveformUrl: delivery?.waveform?.url ?? '',
    spectrogramUrl: delivery?.spectrogram?.url ?? '',
    posterUrl: delivery?.thumbnail?.url ?? '',
  };
}
