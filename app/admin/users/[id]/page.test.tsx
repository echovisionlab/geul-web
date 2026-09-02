// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  updateUserAction: vi.fn(),
  updateMutate: vi.fn(),
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
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'users') {
      return { data: mocks.user, isLoading: false };
    }
    if (queryKey[0] === 'memberTags') {
      return { data: [{ id: 'tag-1', name: 'Editorial' }], isLoading: false };
    }
    return { data: null, isLoading: false };
  },
  useMutation: ({ mutationFn }: { mutationFn: unknown }) => ({
    mutate: String(mutationFn).includes('updateUserAction') ? mocks.updateMutate : vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));
vi.mock('@mantine/form', () => ({
  useForm: () => ({
    values: mocks.formValues,
    setValues: vi.fn(),
    onSubmit: (callback: (values: { nickname: string; bio: string; role: string; tagIds: string[] }) => void) => () =>
      callback(mocks.formValues),
    getInputProps: () => ({}),
  }),
}));
vi.mock('@mantine/hooks', () => ({ useDisclosure: () => [false, { open: vi.fn(), close: vi.fn() }] }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@mantine/core', () => ({
  Divider: () => null,
  Group: ({ children }: { children?: unknown }) => children,
  Modal: ({ children }: { children?: unknown }) => children,
  Stack: ({ children }: { children?: unknown }) => children,
  Text: ({ children }: { children?: unknown }) => children,
}));
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
  getUserAdminAction: vi.fn(),
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
  mocks.invalidateQueries.mockReset();
  mocks.updateUserAction.mockReset();
  mocks.updateMutate.mockReset();
  mocks.profileProps = null;
  mocks.user.role = 'author';
  mocks.user.onboarded = false;
  mocks.formValues = { nickname: 'Member', bio: 'Bio', role: 'author', tagIds: ['tag-1'] };

  act(() => {
    root.render(<AdminUserEditPage params={Promise.resolve({ id: 'member-1' })} />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Admin Member profile controller', () => {
  it('keeps a regular unonboarded Member editable by Admin', () => {
    mocks.user.role = 'user';
    mocks.user.onboarded = false;
    mocks.formValues = { nickname: 'Member', bio: 'Temporary bio', role: 'user', tagIds: ['tag-1'] };
    act(() => {
      root.render(<AdminUserEditPage params={Promise.resolve({ id: 'member-1' })} />);
    });

    expect(mocks.profileProps).not.toBeNull();

    act(() => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mocks.updateMutate).toHaveBeenCalledWith({
      id: 'member-1',
      nickname: 'Member',
      role: 'user',
      tagIds: ['tag-1'],
      bio: 'Temporary bio',
      website: 'https://member.example',
      socialLinks: { github: 'member' },
    });
  });

  it('refreshes the exact Member after an avatar mutation without issuing a generic profile update', async () => {
    expect(mocks.profileProps).not.toBeNull();

    await act(async () => {
      await mocks.profileProps!.onImageChange('https://cdn.example/member.webp');
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['users', 'admin', 'member-1'] });
    expect(mocks.updateUserAction).not.toHaveBeenCalled();
  });
});
