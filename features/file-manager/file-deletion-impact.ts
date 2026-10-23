import type { FileUsageDomain } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import type { FileDeletionImpactView, FileManagerUsageView } from '@/lib/actions/file';

export interface FileDeletionImpactSummary {
  /** Selected Files that are still referenced; any of them blocks the deletion. */
  blockingFileCount: number;
  totalUsageCount: number;
  usagePreview: FileManagerUsageView[];
  hiddenUsageCount: number;
  /** Usage counts per domain across the blocking Files, in domain order. */
  domainCounts: [FileUsageDomain, number][];
}

export function summarizeFileDeletionImpact(
  impacts: readonly FileDeletionImpactView[],
  previewSize: number,
): FileDeletionImpactSummary {
  const blocking = impacts.filter((impact) => impact.totalUsageCount > 0);
  const usagePreview = blocking.flatMap((impact) => impact.firstUsages).slice(0, previewSize);
  const totalUsageCount = blocking.reduce((total, impact) => total + impact.totalUsageCount, 0);
  const counts = new Map<FileUsageDomain, number>();
  for (const entry of blocking.flatMap((impact) => impact.domainCounts)) {
    counts.set(entry.domain, (counts.get(entry.domain) ?? 0) + entry.count);
  }
  return {
    blockingFileCount: blocking.length,
    totalUsageCount,
    usagePreview,
    hiddenUsageCount: Math.max(0, totalUsageCount - usagePreview.length),
    domainCounts: [...counts].sort(([left], [right]) => left - right),
  };
}
