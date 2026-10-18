// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryObserver, type QueryObserverOptions } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryClient: null as QueryClient | null,
  queryOptions: [] as QueryObserverOptions[],
  getUserAdminAction: vi.fn(),
  updateUserAction: vi.fn(),
  updateMutate: vi.fn(),
  updateSuccess: null as
    | null
    | ((
        result: { error?: string },
        variables: {
          id: string;
          nickname?: string;
          bio?: string | null;
          website?: string | null;
          socialLinks?: Record<string, string> | null;
          role?: string;
          tagIds?: string[];
        },
      ) => void),
  updatePending: false,
  dirtyFields: {} as Record<string, boolean>,
  setFormValues: vi.fn(),
  formValues: { nickname: 'Member', bio: 'Bio', role: 'author', tagIds: ['tag-1'] },
  user: {
    id: 'member-1',
    tag_ids: ['tag-1'],
    nickname: 'Member',
    email: 'member@example.com',
    image: null,
    bio: 'Bio',
    website: 'https://member.example',
    social_links: { github: 'member' },
    role: 'author',
    banned: false,
    onboarded: false,
    created_at: null,
    auth_details: null,
    ban_details: null,
  },
  profileProps: null as null | {
    onImageChange: (url: string | null) => Promise<void>;
  },
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, use: () => ({ id: 'member-1' }) };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
// Rendering reads stubbed query results, while the page's own query options are recorded and its invalidations
// reach a real QueryClient, so a refresh is observable through the page's real query key and Member loader.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => mocks.queryClient,
  useQuery: (options: QueryObserverOptions & { queryKey: string[] }) => {
    mocks.queryOptions.push(options);
    const { queryKey } = options;
    if (queryKey[0] === 'users') {
      return { data: mocks.user, isLoading: false };
    }
    if (queryKey[0] === 'memberTags') {
      return { data: [{ id: 'tag-1', name: 'Editorial' }], isLoading: false };
    }
    return { data: null, isLoading: false };
  },
  useMutation: ({ mutationFn, onSuccess }: { mutationFn: unknown; onSuccess?: unknown }) => {
    const isUpdate = String(mutationFn).includes('updateUserAction');
    if (isUpdate) {
      mocks.updateSuccess = onSuccess as typeof mocks.updateSuccess;
    }
    return {
      mutate: isUpdate ? mocks.updateMutate : vi.fn(),
      mutateAsync: vi.fn(),
      isPending: mocks.updatePending,
    };
  },
}));
vi.mock('@mantine/form', () => ({
  useForm: () => ({
    values: mocks.formValues,
    setValues: mocks.setFormValues,
    setInitialValues: vi.fn(),
    resetDirty: vi.fn(),
    isDirty: (path?: string) =>
      path ? Boolean(mocks.dirtyFields[path]) : Object.values(mocks.dirtyFields).some(Boolean),
    onSubmit: (callback: (values: { nickname: string; bio: string; role: string; tagIds: string[] }) => void) => () =>
      callback(mocks.formValues),
    getInputProps: () => ({}),
  }),
}));
vi.mock('@mantine/hooks', () => ({ useDisclosure: () => [false, { open: vi.fn(), close: vi.fn() }] }));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));

vi.mock('@/components/core/Alert', () => ({ Alert: () => null }));
vi.mock('@/components/core/Button', () => ({ Button: () => null }));
vi.mock('@/components/core/Input', () => ({ Select: () => null, TextInput: () => null }));
vi.mock('@/features/editor/EditorHeader', () => ({ EditorHeader: () => null }));
vi.mock('@/features/site/PageLoader', () => ({ PageLoader: () => null }));
vi.mock('@/features/admin/user/auth', () => ({
  UserBanStateSection: () => null,
  UserDeliveryEmailSection: () => null,
  UserSsoProvidersSection: () => null,
}));
vi.mock('@/features/admin/user/UserProfileFormSection', () => ({
  UserProfileFormSection: (props: NonNullable<typeof mocks.profileProps>) => {
    mocks.profileProps = props;
    return null;
  },
}));
vi.mock('@/features/my/PersonalAccessTokenSettings', () => ({ PersonalAccessTokenSettings: () => null }));
vi.mock('@/features/my/mcp-integration-access', () => ({ projectPersonalAccessTokensForSettings: () => [] }));
vi.mock('@/lib/actions/email-suppression', () => ({
  getEmailSuppressionAction: vi.fn(),
  releaseEmailSuppressionAction: vi.fn(),
}));
vi.mock('@/lib/actions/personal-access-token', () => ({ listAccountPersonalAccessTokensAction: vi.fn() }));
vi.mock('@/lib/actions/user', () => ({
  banUserAction: vi.fn(),
  getUserAdminAction: mocks.getUserAdminAction,
  removeUserSsoProviderAction: vi.fn(),
  setUserCanonicalEmailAction: vi.fn(),
  unbanUserAction: vi.fn(),
  updateUserAction: mocks.updateUserAction,
}));
vi.mock('@/lib/actions/user-tag', () => ({ listAllUserTagsAction: vi.fn() }));
vi.mock('@/lib/hooks/useCopyToClipboard', () => ({ useCopyToClipboard: () => ({ copy: vi.fn() }) }));
vi.mock('@/lib/providers/LocaleProvider', () => ({ useLocale: () => 'ko' }));
vi.mock('@/lib/utils/not-found-guard', () => ({ guardNotFound: vi.fn() }));

import AdminUserEditPage from './page';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.queryOptions = [];
  mocks.getUserAdminAction.mockReset().mockImplementation(async () => ({ ok: true, value: mocks.user }));
  mocks.updateUserAction.mockReset();
  mocks.updateMutate.mockReset();
  mocks.updateSuccess = null;
  mocks.updatePending = false;
  mocks.dirtyFields = {};
  mocks.setFormValues.mockReset();
  mocks.profileProps = null;
  mocks.user = {
    id: 'member-1',
    tag_ids: ['tag-1'],
    nickname: 'Member',
    email: 'member@example.com',
    image: null,
    bio: 'Bio',
    website: 'https://member.example',
    social_links: { github: 'member' },
    role: 'author',
    banned: false,
    onboarded: false,
    created_at: null,
    auth_details: null,
    ban_details: null,
  };
  mocks.formValues = { nickname: 'Member', bio: 'Bio', role: 'author', tagIds: ['tag-1'] };

  act(() => {
    root.render(<AdminUserEditPage params={Promise.resolve({ id: 'member-1' })} />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  mocks.queryClient?.clear();
});

describe('Admin Member profile controller', () => {
  it('keeps a regular unonboarded Member editable by Admin', () => {
    mocks.user.role = 'user';
    mocks.user.onboarded = false;
    mocks.formValues = { nickname: 'Member', bio: 'Temporary bio', role: 'user', tagIds: ['tag-1'] };
    mocks.dirtyFields = { bio: true };
    act(() => {
      root.render(<AdminUserEditPage params={Promise.resolve({ id: 'member-1' })} />);
    });

    expect(mocks.profileProps).not.toBeNull();

    act(() => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mocks.updateMutate).toHaveBeenCalledWith({
      id: 'member-1',
      bio: 'Temporary bio',
    });
  });

  it('preserves dirty drafts when refreshed user data arrives, including during a save', () => {
    mocks.dirtyFields = { nickname: true };
    mocks.setFormValues.mockClear();
    mocks.user = { ...mocks.user, nickname: 'Changed elsewhere' };
    act(() => root.render(<AdminUserEditPage params={Promise.resolve({ id: 'member-1' })} />));
    expect(mocks.setFormValues).not.toHaveBeenCalled();

    mocks.updatePending = true;
    mocks.user = { ...mocks.user, bio: 'Also changed elsewhere' };
    act(() => root.render(<AdminUserEditPage params={Promise.resolve({ id: 'member-1' })} />));
    expect(mocks.setFormValues).not.toHaveBeenCalled();
  });

  it('keeps the submitted baseline when the old query snapshot remains after mutation success', () => {
    mocks.setFormValues.mockClear();
    expect(mocks.updateSuccess).not.toBeNull();
    mocks.updatePending = true;
    act(() => root.render(<AdminUserEditPage params={Promise.resolve({ id: 'member-1' })} />));

    act(() => {
      mocks.updateSuccess!({}, { id: 'member-1', bio: 'Saved bio' });
    });
    mocks.updatePending = false;
    act(() => root.render(<AdminUserEditPage params={Promise.resolve({ id: 'member-1' })} />));

    expect(mocks.setFormValues).not.toHaveBeenCalled();
  });

  it('refetches the exact Member after an avatar change without issuing a generic profile update', async () => {
    const memberQuery = mocks.queryOptions.findLast((options) => options.queryKey[0] === 'users');
    expect(memberQuery).toBeDefined();
    const unsubscribe = new QueryObserver(mocks.queryClient!, memberQuery!).subscribe(() => undefined);
    // An avatar change happens on a loaded profile; a refetch of a still-pending load would join it.
    await vi.waitFor(() => expect(mocks.queryClient!.getQueryState(memberQuery!.queryKey)?.status).toBe('success'));
    expect(mocks.getUserAdminAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      await mocks.profileProps!.onImageChange('https://cdn.example/member.webp');
    });

    expect(mocks.getUserAdminAction).toHaveBeenCalledTimes(2);
    expect(mocks.getUserAdminAction).toHaveBeenLastCalledWith('member-1');
    expect(mocks.updateUserAction).not.toHaveBeenCalled();
    unsubscribe();
  });
});
