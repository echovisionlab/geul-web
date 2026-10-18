// @vitest-environment jsdom

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@/test/render';
import { DEFAULT_PAGE_ACCESS_POLICY, type PageAccessPolicyValue } from '@/lib/types/page-access';
import { PageAccessSettings, type PageAccessSettingsProps } from './PageAccessSettings';

vi.mock('next-intl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl')>()),
  useTranslations: () => (key: string, params?: { id: string }) => (params ? `${key} (${params.id})` : key),
}));

function setup(changes: Partial<PageAccessSettingsProps> = {}) {
  let props: PageAccessSettingsProps = {
    value: DEFAULT_PAGE_ACCESS_POLICY,
    tagOptions: [{ value: 'tag-a', label: 'Supporter' }],
    onSave: vi.fn().mockResolvedValue({ ok: true }),
    ...changes,
  };
  const view = render(<PageAccessSettings {...props} />);
  return {
    ...view,
    onSave: props.onSave,
    refresh(changes: Partial<PageAccessSettingsProps>) {
      props = { ...props, ...changes };
      view.rerender(<PageAccessSettings {...props} />);
    },
  };
}

const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const saveButton = () => screen.getByRole('button', { name: 'save' });

async function choose(user: ReturnType<typeof render>['user'], label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
  await user.keyboard('{Escape}');
}

describe('PageAccessSettings', () => {
  const savedConditions: PageAccessPolicyValue = {
    mode: 'conditions',
    match: 'all',
    roles: ['author', 'admin'],
    userTagIds: ['tag-a'],
    newsletterSubscriber: true,
  };

  it('keeps two roles in one condition group and shows the match selector only for multiple groups', async () => {
    const { user, onSave } = setup();
    const audience = within(screen.getByRole('group', { name: 'audience' }));
    const author = audience.getByRole('checkbox', { name: 'roleAuthor' });
    const admin = audience.getByRole('checkbox', { name: 'roleAdmin' });
    const member = audience.getByRole('checkbox', { name: 'roleUser' });
    await user.click(author);
    await user.click(admin);
    expect(member).toBeChecked();
    expect(screen.queryByRole('combobox', { name: 'match' })).toBeNull();
    await choose(user, 'userTags', 'Supporter');
    expect(screen.getByRole('combobox', { name: 'match' })).toBeInTheDocument();
    await user.click(saveButton());
    expect(await screen.findByRole('status')).toHaveTextContent('saved');
    expect(saveButton()).toBeDisabled();
    expect(onSave).toHaveBeenCalledWith({
      mode: 'conditions',
      match: 'any',
      roles: ['author', 'admin'],
      userTagIds: ['tag-a'],
      newsletterSubscriber: false,
    });
  });

  it('saves role, tag, and newsletter groups with the selected match rule', async () => {
    const { user, onSave } = setup({
      value: { ...savedConditions, match: 'any', newsletterSubscriber: false },
    });
    await user.click(checkbox('newsletter'));
    await choose(user, 'match', 'all');
    await user.click(saveButton());
    expect(await screen.findByRole('status')).toHaveTextContent('saved');
    expect(saveButton()).toBeDisabled();
    expect(onSave).toHaveBeenCalledWith(savedConditions);
  });

  it('clears saved role, tag, and newsletter conditions when membership is turned off', async () => {
    const { user, onSave } = setup({ value: savedConditions });
    await user.click(checkbox('roleUser'));
    expect(checkbox('roleAuthor')).not.toBeChecked();
    expect(checkbox('roleAdmin')).not.toBeChecked();
    expect(checkbox('newsletter')).not.toBeChecked();
    expect(screen.queryByText('Supporter')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'match' })).toBeNull();
    await user.click(saveButton());
    expect(await screen.findByRole('status')).toHaveTextContent('saved');
    expect(saveButton()).toBeDisabled();
    expect(onSave).toHaveBeenLastCalledWith(DEFAULT_PAGE_ACCESS_POLICY);
  });

  it.each(['newsletter', 'tag'] as const)(
    'reflects automatic membership for a %s condition in the controls',
    async (condition) => {
      const { user } = setup();
      expect(saveButton()).toBeDisabled();
      expect(checkbox('roleUser')).not.toBeChecked();
      if (condition === 'newsletter') {
        await user.click(checkbox('newsletter'));
      } else {
        await choose(user, 'userTags', 'Supporter');
      }
      expect(checkbox('roleUser')).toBeChecked();
      expect(screen.queryByRole('combobox', { name: 'match' })).toBeNull();
      await user.click(checkbox('roleUser'));
      expect(checkbox('newsletter')).not.toBeChecked();
      expect(screen.queryByText('Supporter')).toBeNull();
      expect(saveButton()).toBeDisabled();
    },
  );

  it('preserves unsaved changes through a peer refresh and discards to the latest remote value', async () => {
    const { user, refresh } = setup();
    await user.click(checkbox('roleAuthor'));
    refresh({ value: { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'authenticated' } });
    expect(checkbox('roleAuthor')).toBeChecked();
    expect(screen.getByText('unsaved')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'cancel' }));
    expect(checkbox('roleUser')).toBeChecked();
    expect(checkbox('roleAuthor')).not.toBeChecked();
    expect(saveButton()).toBeDisabled();
  });

  it('adopts remote changes when the form is pristine', () => {
    const { refresh } = setup();
    refresh({ value: { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'conditions', newsletterSubscriber: true } });
    expect(checkbox('roleUser')).toBeChecked();
    expect(checkbox('newsletter')).toBeChecked();
    expect(saveButton()).toBeDisabled();
  });

  it('adopts server-canonical role, tag, and match controls after saving', async () => {
    const canonical: PageAccessPolicyValue = {
      ...DEFAULT_PAGE_ACCESS_POLICY,
      mode: 'conditions',
      match: 'all',
      roles: ['author', 'admin'],
      userTagIds: ['tag-a'],
    };
    const { user } = setup({ onSave: vi.fn().mockResolvedValue({ ok: true, accessPolicy: canonical }) });
    await user.click(checkbox('roleAuthor'));
    await user.click(saveButton());
    expect(await screen.findByRole('status')).toHaveTextContent('saved');
    expect(checkbox('roleUser')).toBeChecked();
    expect(checkbox('roleAdmin')).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'match' })).toHaveValue('all');
    expect(screen.getByRole('combobox', { name: 'userTags' })).toHaveAccessibleDescription(
      expect.stringContaining('Supporter'),
    );
    expect(saveButton()).toBeDisabled();
  });

  it('keeps success confirmation when the saved policy returns through the parent', async () => {
    const onSave = vi.fn();
    function Parent() {
      const [value, setValue] = useState(DEFAULT_PAGE_ACCESS_POLICY);
      return (
        <PageAccessSettings
          value={value}
          tagOptions={[]}
          onSave={async (next) => {
            onSave(next);
            setValue(next);
            return { ok: true };
          }}
        />
      );
    }
    const { user } = render(<Parent />);
    await user.click(checkbox('roleUser'));
    await user.click(saveButton());
    expect(await screen.findByRole('status')).toHaveTextContent('saved');
    expect(onSave).toHaveBeenCalledWith({ ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'authenticated' });
    expect(saveButton()).toBeDisabled();
  });

  it('retains unavailable tag ids and draft values after failure, then retries', async () => {
    const onSave = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'Permission changed' })
      .mockResolvedValueOnce({ ok: true });
    const { user } = setup({
      value: { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'conditions', userTagIds: ['missing-tag'] },
      onSave,
    });
    expect(screen.getByRole('combobox', { name: 'userTags' })).toHaveAccessibleDescription(
      expect.stringContaining('unavailableTag (missing-tag)'),
    );
    await user.click(checkbox('roleAuthor'));
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Permission changed');
    expect(checkbox('roleAuthor')).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'userTags' })).toHaveAccessibleDescription(
      expect.stringContaining('unavailableTag (missing-tag)'),
    );
    await user.click(saveButton());
    expect(await screen.findByRole('status')).toHaveTextContent('saved');
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1][0]).toMatchObject({ roles: ['author'], userTagIds: ['missing-tag'] });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables edits while saving and retains the draft after a rejected save', async () => {
    let reject!: (error: Error) => void;
    const promise = new Promise<{ ok: true }>((_, fail) => {
      reject = fail;
    });
    const { user, onSave } = setup({ onSave: vi.fn().mockReturnValue(promise) });
    await user.click(checkbox('newsletter'));
    await user.click(saveButton());
    expect(checkbox('roleUser')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'cancel' })).toBeDisabled();
    const saving = screen.getByRole('button', { name: 'saving' });
    expect(saving).toHaveAttribute('aria-disabled', 'true');
    await user.click(saving);
    expect(onSave).toHaveBeenCalledOnce();
    reject(new Error('Network unavailable'));
    expect(await screen.findByRole('alert')).toHaveTextContent('saveError');
    expect(checkbox('newsletter')).toBeChecked();
    expect(saveButton()).toBeEnabled();
  });

  it('disables all access controls for read-only editors', async () => {
    const { user, onSave } = setup({
      value: { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'conditions', roles: ['author'] },
      disabled: true,
    });
    for (const input of within(screen.getByRole('group', { name: 'audience' })).getAllByRole('checkbox')) {
      expect(input).toBeDisabled();
    }
    expect(screen.getByRole('combobox', { name: 'userTags' })).toBeDisabled();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'cancel' })).toBeDisabled();
    await user.click(checkbox('roleAdmin'));
    await user.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
    expect(checkbox('roleAdmin')).not.toBeChecked();
  });
});
