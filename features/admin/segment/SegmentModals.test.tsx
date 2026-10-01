// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  editingSegmentId: null as string | null,
  closeEdit: vi.fn(),
  getSegmentAction: vi.fn(),
  updateSegmentAction: vi.fn(),
  notificationsShow: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notificationsShow } }));
vi.mock('@mantine/core', () => ({
  Loader: () => null,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/lib/actions/audience', () => ({
  archiveSegmentAction: vi.fn(),
  createSegmentAction: vi.fn(),
  estimateSegmentCountAction: vi.fn(),
  getSegmentAction: mocks.getSegmentAction,
  restoreSegmentAction: vi.fn(),
  updateSegmentAction: mocks.updateSegmentAction,
}));
vi.mock('./SegmentModalContext', () => ({
  useSegmentModal: () => ({
    lifecycleSegment: null,
    lifecycleAction: null,
    closeLifecycle: vi.fn(),
    isCreateOpen: false,
    closeCreate: vi.fn(),
    editingSegmentId: mocks.editingSegmentId,
    closeEdit: mocks.closeEdit,
  }),
}));
vi.mock('@/components/core/Input', () => ({
  Select: () => null,
  TextInput: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  }) => <input aria-label={label} value={value} onChange={onChange} />,
}));
vi.mock('@/components/core/Modal', () => ({
  ConfirmModal: () => null,
  FormModal: ({
    opened,
    children,
    onSubmit,
  }: {
    opened: boolean;
    children: ReactNode;
    onSubmit?: () => void | Promise<void>;
  }) =>
    opened ? (
      <div data-testid="segment-form">
        {children}
        <button type="button" data-testid="save-segment" onClick={() => void onSubmit?.()}>
          Save
        </button>
      </div>
    ) : null,
}));
vi.mock('./SegmentConfigFields', () => ({ SegmentConfigFields: () => null }));

import { SegmentModals } from './SegmentModals';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type SegmentResult = {
  data: {
    name: string;
    description: string;
    segmentType: number;
    config: { memberTagIds: string[]; accountRoles: string[]; createdAfter?: string; createdBefore?: string };
    estimatedCount: number;
  };
};

type SegmentUpdateResult = {
  data: {
    id: string;
    name: string;
    description: string;
    segmentType: SegmentType;
    config: { memberTagIds: string[]; accountRoles: string[]; createdAfter?: string; createdBefore?: string };
    estimatedCount: number | null;
    archivedAt: Date | null;
  };
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mocks.editingSegmentId = null;
  mocks.closeEdit.mockReset();
  mocks.getSegmentAction.mockReset();
  mocks.updateSegmentAction.mockReset();
  mocks.notificationsShow.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderForSegment(id: string | null) {
  mocks.editingSegmentId = id;
  act(() => root.render(<SegmentModals />));
}

function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function updateResult(name: string, accountRoles: string[] = ['user']): SegmentUpdateResult {
  return {
    data: {
      id: 'segment-a',
      name,
      description: 'A description',
      segmentType: SegmentType.MEMBERS_BY_FILTER,
      config: { memberTagIds: [], accountRoles, createdAfter: undefined, createdBefore: undefined },
      estimatedCount: 20,
      archivedAt: null,
    },
  };
}

describe('SegmentModals edit loading', () => {
  it('ignores an edit response after its segment was closed and another segment opened', async () => {
    const segmentA = deferred<SegmentResult>();
    const segmentB = deferred<SegmentResult>();
    mocks.getSegmentAction.mockImplementation((id: string) =>
      id === 'segment-a' ? segmentA.promise : segmentB.promise,
    );

    renderForSegment('segment-a');
    renderForSegment(null);
    renderForSegment('segment-b');

    await act(async () => {
      segmentB.resolve({
        data: {
          name: 'Segment B',
          description: 'B description',
          segmentType: 1,
          config: { memberTagIds: [], accountRoles: [] },
          estimatedCount: 20,
        },
      });
      await segmentB.promise;
    });

    expect(container.querySelector<HTMLInputElement>('[aria-label="labels.name"]')?.value).toBe('Segment B');

    await act(async () => {
      segmentA.resolve({
        data: {
          name: 'Segment A',
          description: 'A description',
          segmentType: 1,
          config: { memberTagIds: [], accountRoles: [] },
          estimatedCount: 10,
        },
      });
      await segmentA.promise;
    });

    expect(container.querySelector<HTMLInputElement>('[aria-label="labels.name"]')?.value).toBe('Segment B');
  });

  it('sends only touched scalar optionals and rebases typing over the canonical save response', async () => {
    const pendingUpdate = deferred<SegmentUpdateResult>();
    const finalUpdate = deferred<SegmentUpdateResult>();
    mocks.getSegmentAction.mockResolvedValue({
      data: {
        name: 'Segment A',
        description: 'A description',
        segmentType: SegmentType.MEMBERS_BY_FILTER,
        config: { memberTagIds: [], accountRoles: ['user'] },
        estimatedCount: 20,
      },
    });
    mocks.updateSegmentAction.mockReturnValueOnce(pendingUpdate.promise).mockReturnValueOnce(finalUpdate.promise);

    renderForSegment('segment-a');
    await act(async () => {
      await Promise.resolve();
    });

    const nameInput = container.querySelector<HTMLInputElement>('[aria-label="labels.name"]');
    expect(nameInput).not.toBeNull();
    changeInput(nameInput!, 'Local name');
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="save-segment"]')?.click());

    expect(mocks.updateSegmentAction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'segment-a',
        name: 'Local name',
        config: expect.objectContaining({ accountRoles: [AuthorizationRole.USER] }),
        observed: expect.objectContaining({
          segmentType: SegmentType.MEMBERS_BY_FILTER,
          config: expect.objectContaining({ accountRoles: [AuthorizationRole.USER] }),
        }),
      }),
    );
    const submitted = mocks.updateSegmentAction.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.hasOwn(submitted, 'description')).toBe(false);
    expect(Object.hasOwn(submitted, 'segmentType')).toBe(false);

    changeInput(nameInput!, 'Typed while save is pending');
    await act(async () => {
      pendingUpdate.resolve(updateResult('Local name', ['admin', 'user']));
      await pendingUpdate.promise;
    });

    expect(container.querySelector<HTMLInputElement>('[aria-label="labels.name"]')?.value).toBe(
      'Typed while save is pending',
    );
    expect(container.querySelector('[data-testid="segment-form"]')).not.toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="save-segment"]')?.click();
      finalUpdate.resolve(updateResult('Pending second name', ['admin', 'user']));
      await finalUpdate.promise;
    });
    expect(mocks.updateSegmentAction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: 'Typed while save is pending',
        observed: expect.objectContaining({
          config: expect.objectContaining({ accountRoles: [AuthorizationRole.ADMIN, AuthorizationRole.USER] }),
        }),
      }),
    );
    expect(Object.hasOwn(mocks.updateSegmentAction.mock.calls[1][0] as object, 'description')).toBe(false);
    expect(Object.hasOwn(mocks.updateSegmentAction.mock.calls[1][0] as object, 'segmentType')).toBe(false);
    expect(mocks.closeEdit).toHaveBeenCalled();
  });
});
