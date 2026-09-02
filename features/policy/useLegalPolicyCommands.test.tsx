// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LegalPolicyEditorStrategy } from './legal-policy-types';
import { useLegalPolicyCommands } from './useLegalPolicyCommands';

const mocks = vi.hoisted(() => ({
  mutationFns: [] as Array<(value?: unknown) => Promise<unknown>>,
  invalidateQueries: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  show: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: { mutationFn: (value?: unknown) => Promise<unknown> }) => {
    mocks.mutationFns.push(options.mutationFn);
    return options;
  },
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.show },
}));

const messages = {
  scheduled: 'scheduled',
  scheduleFailed: 'schedule failed',
  scheduleCancelled: 'cancelled',
  cancelScheduleFailed: 'cancel failed',
  activated: 'activated',
  activateFailed: 'activate failed',
  deleted: 'deleted',
  deleteFailed: 'delete failed',
  regenerated: 'regenerated',
  regenerateFailed: 'regenerate failed',
};

describe('useLegalPolicyCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutationFns.length = 0;
  });

  it('flushes the active Block document before requesting derived-content regeneration', async () => {
    const order: string[] = [];
    const regenerateHtml = vi.fn(async () => {
      order.push('regenerate');
      return { success: true };
    });
    const strategy = {
      entityType: 'privacy',
      listPath: '/admin/privacy',
      status: { isDraft: () => true },
      actions: {
        schedule: vi.fn(),
        cancelSchedule: vi.fn(),
        activateNow: vi.fn(),
        deleteVersion: vi.fn(),
        regenerateHtml,
      },
    } as unknown as LegalPolicyEditorStrategy;

    function Harness() {
      useLegalPolicyCommands({
        policyId: 'privacy-1',
        policyStatus: 'draft',
        strategy,
        flushActiveDocuments: async () => {
          order.push('flush');
        },
        closeScheduleModal: vi.fn(),
        closeCancelModal: vi.fn(),
        closeActivateModal: vi.fn(),
        clearEffectiveFrom: vi.fn(),
        messages,
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<Harness />));

    expect(mocks.mutationFns).toHaveLength(5);
    await mocks.mutationFns[4]?.();
    expect(order).toEqual(['flush', 'regenerate']);
    expect(regenerateHtml).toHaveBeenCalledWith('privacy-1');
    act(() => root.unmount());
  });
});
