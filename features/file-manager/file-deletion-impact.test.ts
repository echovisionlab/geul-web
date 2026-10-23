import { FileUsageDomain } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { describe, expect, it } from 'vitest';
import type { FileDeletionImpactView } from '@/lib/actions/file';
import { summarizeFileDeletionImpact } from './file-deletion-impact';

function impact(index: number, domain = FileUsageDomain.POST, totalUsageCount = 1): FileDeletionImpactView {
  return {
    fileId: `file-${index}`,
    totalUsageCount,
    domainCounts: totalUsageCount ? [{ domain, count: totalUsageCount }] : [],
    firstUsages: totalUsageCount
      ? [{ domain, entityId: `entity-${index}`, slot: 'editor', title: `Usage ${index}`, count: totalUsageCount }]
      : [],
    hasMoreUsages: false,
  };
}

describe('summarizeFileDeletionImpact', () => {
  it('previews at most the given number of usages and counts the rest across all selected Files', () => {
    const summary = summarizeFileDeletionImpact(
      Array.from({ length: 6 }, (_, index) => impact(index + 1)),
      5,
    );

    expect(summary.blockingFileCount).toBe(6);
    expect(summary.totalUsageCount).toBe(6);
    expect(summary.usagePreview.map((usage) => usage.title)).toEqual([
      'Usage 1',
      'Usage 2',
      'Usage 3',
      'Usage 4',
      'Usage 5',
    ]);
    expect(summary.hiddenUsageCount).toBe(1);
    expect(summary.domainCounts).toEqual([[FileUsageDomain.POST, 6]]);
  });

  it('adds usages per domain and lists the domains in order', () => {
    const summary = summarizeFileDeletionImpact(
      [impact(1, FileUsageDomain.PAGE, 2), impact(2, FileUsageDomain.POST, 3), impact(3, FileUsageDomain.PAGE, 1)],
      5,
    );

    // POST (1) sorts before PAGE (2) in the domain enum, not in selection order.
    expect(summary.domainCounts).toEqual([
      [FileUsageDomain.POST, 3],
      [FileUsageDomain.PAGE, 3],
    ]);
    expect(summary.totalUsageCount).toBe(6);
    expect(summary.hiddenUsageCount).toBe(3);
  });

  it('does not block on Files that are not in use', () => {
    expect(summarizeFileDeletionImpact([impact(1, FileUsageDomain.POST, 0)], 5)).toEqual({
      blockingFileCount: 0,
      totalUsageCount: 0,
      usagePreview: [],
      hiddenUsageCount: 0,
      domainCounts: [],
    });
  });
});
