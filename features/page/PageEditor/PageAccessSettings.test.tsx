// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGE_ACCESS_POLICY } from '@/lib/types/page-access';
import { PageAccessSettings, type PageAccessSettingsProps } from './PageAccessSettings';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: { id: string }) => (params ? `${key} (${params.id})` : key),
}));

// jsdom does not implement scrolling, which Mantine's combobox uses for keyboard focus.
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: () => {} });

let host: HTMLDivElement;
let root: Root;
let props: PageAccessSettingsProps;

function render(changes: Partial<PageAccessSettingsProps> = {}) {
  props = { ...props, ...changes };
  act(() =>
    root.render(
      <MantineProvider env="test">
        <PageAccessSettings {...props} />
      </MantineProvider>,
    ),
  );
}

function button(text: string) {
  const found = [...host.querySelectorAll<HTMLButtonElement>('button')].find((node) => node.textContent === text);
  expect(found, `button ${text}`).toBeDefined();
  return found!;
}

function checkbox(label: string) {
  const found = [...host.querySelectorAll<HTMLLabelElement>('label')].find((node) => node.textContent === label);
  expect(found, `checkbox ${label}`).toBeDefined();
  return document.getElementById(found!.htmlFor) as HTMLInputElement;
}

function choose(label: string, option: string) {
  const found = [...host.querySelectorAll<HTMLLabelElement>('label')].find((node) => node.textContent === label);
  expect(found, `select ${label}`).toBeDefined();
  const input = document.getElementById(found!.htmlFor)!;
  act(() => input.click());
  const choice = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (node) => node.textContent === option,
  );
  expect(choice, `option ${option}`).toBeDefined();
  act(() => choice!.click());
}

async function save() {
  await act(async () => button('save').click());
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  props = {
    value: DEFAULT_PAGE_ACCESS_POLICY,
    tagOptions: [{ value: 'tag-a', label: 'Supporter' }],
    onSave: vi.fn().mockResolvedValue({ ok: true }),
  };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('PageAccessSettings', () => {
  it('selects membership automatically for newsletter access without storing a broad member role', async () => {
    render();
    expect(button('save')).toBeDisabled();
    expect(checkbox('roleUser')).not.toBeChecked();
    act(() => checkbox('newsletter').click());
    expect(checkbox('roleUser')).toBeChecked();
    expect(host.textContent).not.toContain('matchDescription');
    await save();
    expect(props.onSave).toHaveBeenCalledWith({
      ...DEFAULT_PAGE_ACCESS_POLICY,
      mode: 'conditions',
      newsletterSubscriber: true,
    });
    expect(host.querySelector('[role="status"]')).toHaveTextContent('saved');
    expect(button('save')).toBeDisabled();
  });

  it('selects membership automatically when a member tag is chosen', async () => {
    render();
    choose('userTags', 'Supporter');
    expect(checkbox('roleUser')).toBeChecked();
    expect(host.textContent).not.toContain('matchDescription');
    await save();
    expect(props.onSave).toHaveBeenCalledWith({
      ...DEFAULT_PAGE_ACCESS_POLICY,
      mode: 'conditions',
      userTagIds: ['tag-a'],
    });
  });

  it('keeps two roles in one condition group and shows the match selector only for multiple groups', async () => {
    render();
    act(() => checkbox('roleAuthor').click());
    act(() => checkbox('roleAdmin').click());
    expect(checkbox('roleUser')).toBeChecked();
    expect(host.textContent).not.toContain('matchDescription');
    choose('userTags', 'Supporter');
    expect(host.textContent).toContain('matchDescription');
    act(() => checkbox('newsletter').click());
    choose('match', 'all');
    await save();
    expect(props.onSave).toHaveBeenCalledWith({
      mode: 'conditions',
      match: 'all',
      roles: ['author', 'admin'],
      userTagIds: ['tag-a'],
      newsletterSubscriber: true,
    });
  });

  it('saves membership alone as authenticated and none selected as public', async () => {
    render();
    act(() => checkbox('roleUser').click());
    await save();
    expect(props.onSave).toHaveBeenLastCalledWith({ ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'authenticated' });
    act(() => checkbox('roleUser').click());
    await save();
    expect(props.onSave).toHaveBeenLastCalledWith(DEFAULT_PAGE_ACCESS_POLICY);
  });

  it('clears every narrowing condition when membership is unchecked', async () => {
    render({
      value: { mode: 'conditions', match: 'all', roles: ['admin'], userTagIds: ['tag-a'], newsletterSubscriber: true },
    });
    act(() => checkbox('roleUser').click());
    expect(checkbox('roleAdmin')).not.toBeChecked();
    expect(checkbox('newsletter')).not.toBeChecked();
    expect(host.textContent).not.toContain('matchDescription');
    await save();
    expect(props.onSave).toHaveBeenCalledWith(DEFAULT_PAGE_ACCESS_POLICY);
    act(() => checkbox('roleUser').click());
    await save();
    expect(props.onSave).toHaveBeenLastCalledWith({ ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'authenticated' });
  });

  it('returns to membership-only access when the last narrowing condition is removed', async () => {
    render({ value: { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'conditions', newsletterSubscriber: true } });
    act(() => checkbox('newsletter').click());
    expect(checkbox('roleUser')).toBeChecked();
    await save();
    expect(props.onSave).toHaveBeenCalledWith({ ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'authenticated' });
  });

  it('preserves unsaved changes through a peer refresh and discards to the latest remote value', () => {
    render();
    act(() => checkbox('roleAuthor').click());
    render({ value: { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'authenticated' } });
    expect(checkbox('roleAuthor')).toBeChecked();
    expect(host.textContent).toContain('unsaved');
    act(() => button('cancel').click());
    expect(checkbox('roleUser')).toBeChecked();
    expect(checkbox('roleAuthor')).not.toBeChecked();
    expect(button('save')).toBeDisabled();
  });

  it('adopts remote changes when the form is pristine', () => {
    render();
    render({ value: { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'conditions', newsletterSubscriber: true } });
    expect(checkbox('roleUser')).toBeChecked();
    expect(checkbox('newsletter')).toBeChecked();
    expect(button('save')).toBeDisabled();
  });

  it('adopts server-canonical role, tag, and match controls after saving', async () => {
    const canonical = {
      ...DEFAULT_PAGE_ACCESS_POLICY,
      mode: 'conditions' as const,
      match: 'all' as const,
      roles: ['author' as const, 'admin' as const],
      userTagIds: ['tag-a'],
    };
    render({ onSave: vi.fn().mockResolvedValue({ ok: true, accessPolicy: canonical }) });
    act(() => checkbox('roleAuthor').click());
    await save();
    expect(checkbox('roleUser')).toBeChecked();
    expect(checkbox('roleAdmin')).toBeChecked();
    const match = [...host.querySelectorAll<HTMLLabelElement>('label')].find((node) => node.textContent === 'match')!;
    expect(document.getElementById(match.htmlFor)).toHaveValue('all');
    expect(host.textContent).toContain('Supporter');
    expect(button('save')).toBeDisabled();
  });

  it('keeps success confirmation when the saved policy returns through the parent', async () => {
    render({
      onSave: async (value) => {
        render({ value });
        return { ok: true };
      },
    });
    act(() => checkbox('roleUser').click());
    await save();
    expect(host.querySelector('[role="status"]')).toHaveTextContent('saved');
    expect(button('save')).toBeDisabled();
  });

  it('retains unavailable tag ids and draft values after failure, then retries', async () => {
    const onSave = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'Permission changed' })
      .mockResolvedValueOnce({ ok: true });
    render({ value: { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'conditions', userTagIds: ['missing-tag'] }, onSave });
    expect(host.textContent).toContain('unavailableTag (missing-tag)');
    act(() => checkbox('roleAuthor').click());
    await save();
    expect(host.querySelector('[role="alert"]')).toHaveTextContent('Permission changed');
    expect(checkbox('roleAuthor')).toBeChecked();
    expect(host.textContent).toContain('unavailableTag (missing-tag)');
    await save();
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1][0]).toMatchObject({ roles: ['author'], userTagIds: ['missing-tag'] });
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('disables edits while saving and retains the draft after a rejected save', async () => {
    let reject!: (error: Error) => void;
    const promise = new Promise<{ ok: true }>((_, fail) => {
      reject = fail;
    });
    render({ onSave: vi.fn().mockReturnValue(promise) });
    act(() => checkbox('newsletter').click());
    act(() => button('save').click());
    expect(checkbox('roleUser')).toBeDisabled();
    expect(button('cancel')).toBeDisabled();
    expect(button('saving')).toBeDisabled();
    await act(async () => reject(new Error('Network unavailable')));
    expect(host.querySelector('[role="alert"]')).toHaveTextContent('saveError');
    expect(checkbox('newsletter')).toBeChecked();
    expect(button('save')).not.toBeDisabled();
  });

  it('disables all access controls for read-only editors', () => {
    render({ value: { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'conditions', roles: ['author'] }, disabled: true });
    for (const input of host.querySelectorAll('input:not([type="hidden"])')) {
      expect(input).toBeDisabled();
    }
    expect(button('save')).toBeDisabled();
    expect(button('cancel')).toBeDisabled();
    act(() => checkbox('roleAdmin').click());
    act(() => button('save').click());
    expect(props.onSave).not.toHaveBeenCalled();
    expect(checkbox('roleAdmin')).not.toBeChecked();
  });
});
