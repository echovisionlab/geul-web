// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  copied: false,
  copy: vi.fn(),
  checkNicknameAvailabilityAction: vi.fn(),
  mutate: vi.fn(),
  notificationsShow: vi.fn(),
  updateMemberSummary: vi.fn(),
  updateProfileAction: vi.fn(),
  mutationOptions: null as null | {
    onSuccess: (result: {
      member?: { id: string; nickname: string; avatarUrl: string | null; deleted: boolean };
      error?: string;
    }) => Promise<void>;
    onError: (error: unknown) => void;
  },
  viewProps: null as null | {
    copied: boolean;
    errors: { form?: string };
    showExtendedFields: boolean;
    events: {
      onCopyUid: () => void;
      onNicknameChange: (value: string) => void;
      onNormalizeSocialLink: (platform: string, value: string) => string;
      onSubmit: (values: {
        nickname: string;
        bio: string;
        website: string;
        socialLinks: { key: string; platform: string; value: string }[];
      }) => void;
    };
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: NonNullable<typeof mocks.mutationOptions>) => {
    mocks.mutationOptions = options;
    return { mutate: mocks.mutate, isPending: false };
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@mantine/hooks', () => ({
  useClipboard: () => ({ copied: mocks.copied, copy: mocks.copy }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notificationsShow },
}));

vi.mock('@/features/my/ui/ProfileForm', () => ({
  ProfileFormView: (props: NonNullable<typeof mocks.viewProps>) => {
    mocks.viewProps = props;
    return null;
  },
}));

vi.mock('@/lib/actions/user', () => ({
  checkNicknameAvailabilityAction: mocks.checkNicknameAvailabilityAction,
  updateProfileAction: mocks.updateProfileAction,
}));

vi.mock('@/lib/auth/client', () => ({
  useSession: () => ({ updateMemberSummary: mocks.updateMemberSummary }),
}));

import { ProfileForm } from './ProfileForm';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const initialUser = {
  id: 'usr_profile_1',
  nickname: 'June Han',
  role: 'author',
  bio: 'Sound artist and curator.',
  website: 'https://june.example.com',
  socialLinks: {
    0: 'https://instagram.com/june',
    1: 'https://github.com/june',
  },
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.copied = false;
  mocks.mutationOptions = null;
  mocks.viewProps = null;
  mocks.copy.mockReset();
  mocks.checkNicknameAvailabilityAction.mockReset();
  mocks.checkNicknameAvailabilityAction.mockResolvedValue({ available: true });
  mocks.mutate.mockReset();
  mocks.notificationsShow.mockReset();
  mocks.updateMemberSummary.mockReset();
  mocks.updateProfileAction.mockReset();

  act(() => {
    root.render(<ProfileForm initialUser={initialUser} />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function getViewProps() {
  expect(mocks.viewProps).not.toBeNull();
  return mocks.viewProps!;
}

function getMutationOptions() {
  expect(mocks.mutationOptions).not.toBeNull();
  return mocks.mutationOptions!;
}

describe('ProfileForm controller', () => {
  it('maps copy, normalization, and ordered submit commands to controller services', () => {
    const view = getViewProps();

    act(() => view.events.onCopyUid());
    expect(mocks.copy).toHaveBeenCalledWith('usr_profile_1');
    expect(view.events.onNormalizeSocialLink('instagram', 'june')).toBe('https://instagram.com/june');

    act(() => view.events.onNicknameChange('June Park'));
    act(() =>
      getViewProps().events.onSubmit({
        nickname: 'June Park',
        bio: 'Updated bio',
        website: 'https://june.example.com/new',
        socialLinks: [
          { key: 'github', platform: 'github', value: 'june' },
          { key: 'instagram', platform: 'instagram', value: 'https://instagram.com/june' },
        ],
      }),
    );

    expect(mocks.mutate).toHaveBeenCalledWith({
      nickname: 'June Park',
      bio: 'Updated bio',
      website: 'https://june.example.com/new',
      social_links: {
        0: 'https://github.com/june',
        1: 'https://instagram.com/june',
      },
    });
  });

  it('limits a regular Member profile update to the nickname', () => {
    act(() => {
      root.render(<ProfileForm initialUser={{ ...initialUser, role: 'user' }} />);
    });

    const view = getViewProps();
    expect(view.showExtendedFields).toBe(false);

    act(() => view.events.onNicknameChange('June Member'));
    act(() =>
      getViewProps().events.onSubmit({
        nickname: 'June Member',
        bio: 'Ignored bio',
        website: 'https://ignored.example.com',
        socialLinks: [{ key: 'github', platform: 'github', value: 'ignored' }],
      }),
    );

    expect(mocks.mutate).toHaveBeenLastCalledWith({ nickname: 'June Member' });
  });

  it('notifies and applies the returned bounded Member summary after a successful mutation', async () => {
    const member = {
      id: 'usr_profile_1',
      nickname: 'June Park',
      avatarUrl: null,
      deleted: false,
    };
    await act(async () => {
      await getMutationOptions().onSuccess({ member });
    });

    expect(mocks.notificationsShow).toHaveBeenCalledWith({
      title: 'profile.notifications.successTitle',
      message: 'profile.notifications.updated',
      color: 'green',
    });
    expect(mocks.updateMemberSummary).toHaveBeenCalledWith(member);
    expect(getViewProps().errors).toEqual({});
  });

  it('exposes returned and thrown mutation errors without changing the viewer cache', async () => {
    await act(async () => {
      await getMutationOptions().onSuccess({ error: 'Returned failure' });
    });

    expect(mocks.notificationsShow).toHaveBeenLastCalledWith({
      title: 'common.labels.error',
      message: 'Returned failure',
      color: 'red',
    });
    expect(getViewProps().errors).toEqual({ form: 'Returned failure' });
    expect(mocks.updateMemberSummary).not.toHaveBeenCalled();

    act(() => getMutationOptions().onError(new Error('Thrown failure')));
    expect(mocks.notificationsShow).toHaveBeenLastCalledWith({
      title: 'common.labels.error',
      message: 'Thrown failure',
      color: 'red',
    });
    expect(getViewProps().errors).toEqual({ form: 'Thrown failure' });
    expect(mocks.updateMemberSummary).not.toHaveBeenCalled();
  });
});
