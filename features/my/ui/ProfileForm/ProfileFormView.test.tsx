// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ProfileFormView, type ProfileFormViewLabels, type ProfileFormViewProps } from './ProfileFormView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

const labels: ProfileFormViewLabels = {
  uid: 'UID',
  copyUid: 'Copy UID',
  copiedUid: 'UID copied',
  nickname: 'Nickname',
  nicknamePlaceholder: 'Choose a nickname',
  bio: 'Bio',
  bioPlaceholder: 'Tell us about yourself',
  website: 'Website',
  websitePlaceholder: 'https://example.com',
  socialLinks: 'Social links',
  addSocialLink: 'Add link',
  socialPlatform: 'Platform',
  socialValue: 'URL or username',
  removeSocialLink: (position) => `Remove social link ${position}`,
  reorderSocialLink: (position) => `Reorder social link ${position}`,
  submit: 'Update profile',
};

const onCopyUid = vi.fn();
const onNicknameChange = vi.fn();
const onNormalizeSocialLink = vi.fn((_platform: string, value: string) => value);
const onSubmit = vi.fn();
let container: HTMLDivElement;
let root: Root;

const defaultProps: ProfileFormViewProps = {
  initialValues: {
    uid: 'usr_profile_1',
    nickname: 'June Han',
    bio: 'Sound artist and curator.',
    website: 'https://june.example.com',
    socialLinks: [{ key: '0', platform: 'instagram', value: 'https://instagram.com/june' }],
  },
  labels,
  platformOptions: [
    { value: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username' },
    { value: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
  ],
  showExtendedFields: true,
  events: { onCopyUid, onNicknameChange, onNormalizeSocialLink, onSubmit },
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  onCopyUid.mockReset();
  onNicknameChange.mockReset();
  onNormalizeSocialLink.mockReset();
  onNormalizeSocialLink.mockImplementation((_platform, value) => value);
  onSubmit.mockReset();
});

function renderView(overrides: Partial<ProfileFormViewProps> = {}) {
  act(() => {
    root.render(
      <MantineProvider>
        <ProfileFormView {...defaultProps} {...overrides} />
      </MantineProvider>,
    );
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ProfileFormView', () => {
  it('renders display-ready values and forwards copy intent with semantic Core tones', () => {
    renderView();

    expect(container.querySelector<HTMLInputElement>('#profile-uid')?.value).toBe('usr_profile_1');
    expect(container.querySelector<HTMLInputElement>('#profile-nickname')?.value).toBe('June Han');

    const copyButton = container.querySelector<HTMLButtonElement>('[aria-label="Copy UID"]');
    expect(copyButton?.dataset.tone).toBe('neutral');

    act(() => copyButton?.click());
    expect(onCopyUid).toHaveBeenCalledOnce();

    for (const control of container.querySelectorAll<HTMLElement>('[data-tone]')) {
      expect(['accent', 'neutral', 'positive', 'warning', 'danger']).toContain(control.dataset.tone);
    }
  });

  it('submits edited values and supports adding and removing social-link rows', () => {
    renderView();

    const nameInput = container.querySelector<HTMLInputElement>('#profile-nickname');
    expect(nameInput).not.toBeNull();
    act(() => setInputValue(nameInput!, 'June Park'));

    const addButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Add link'),
    );
    act(() => addButton?.click());
    expect(container.querySelectorAll('[data-social-link-row]')).toHaveLength(2);

    const removeSecond = container.querySelector<HTMLButtonElement>('[aria-label="Remove social link 2"]');
    act(() => removeSecond?.click());
    expect(container.querySelectorAll('[data-social-link-row]')).toHaveLength(1);

    const form = container.querySelector('form');
    act(() => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledWith({
      nickname: 'June Park',
      bio: 'Sound artist and curator.',
      website: 'https://june.example.com',
      socialLinks: [{ key: '0', platform: 'instagram', value: 'https://instagram.com/june' }],
    });
  });

  it('normalizes social values on blur and submits reordered links in display order', () => {
    onNormalizeSocialLink.mockImplementation((platform, value) =>
      platform === 'instagram' && value === 'june' ? 'https://instagram.com/june' : value,
    );
    renderView({
      initialValues: {
        ...defaultProps.initialValues,
        socialLinks: [
          { key: 'instagram', platform: 'instagram', value: 'june' },
          { key: 'github', platform: 'github', value: 'https://github.com/june' },
        ],
      },
    });

    const instagramValue = container.querySelector<HTMLInputElement>('#profile-social-value-0');
    act(() => instagramValue?.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(onNormalizeSocialLink).toHaveBeenCalledWith('instagram', 'june');
    expect(instagramValue?.value).toBe('https://instagram.com/june');

    const firstReorderButton = container.querySelector<HTMLButtonElement>(
      '[data-social-link-row="instagram"] [aria-label="Reorder social link 1"]',
    );
    act(() => firstReorderButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));

    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-social-link-row]'));
    expect(rows.map((row) => row.dataset.socialLinkRow)).toEqual(['github', 'instagram']);

    act(() => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenLastCalledWith({
      nickname: 'June Han',
      bio: 'Sound artist and curator.',
      website: 'https://june.example.com',
      socialLinks: [
        { key: 'github', platform: 'github', value: 'https://github.com/june' },
        { key: 'instagram', platform: 'instagram', value: 'https://instagram.com/june' },
      ],
    });
  });

  it('renders external errors and disables every command in the disabled state', () => {
    renderView({
      disabled: true,
      errors: {
        form: 'Profile update failed.',
        nickname: 'Nickname is required.',
        website: 'Enter a valid URL.',
        socialLinks: 'Choose a platform.',
      },
    });

    expect(container.textContent).toContain('Profile update failed.');
    expect(container.textContent).toContain('Nickname is required.');
    expect(container.textContent).toContain('Enter a valid URL.');
    expect(container.textContent).toContain('Choose a platform.');

    for (const button of container.querySelectorAll<HTMLButtonElement>('button')) {
      expect(button.disabled).toBe(true);
    }
    expect(container.querySelector<HTMLInputElement>('#profile-nickname')?.disabled).toBe(true);
    expect(container.querySelector<HTMLTextAreaElement>('#profile-bio')?.disabled).toBe(true);
  });
});
