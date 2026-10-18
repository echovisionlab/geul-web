// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { EmbedSettingsForm } from './SettingsForm';
import type { EmbedProps } from './schema';

vi.mock('next-intl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl')>()),
  useTranslations: () => (key: string) => key,
}));

function setup(props: Partial<EmbedProps>, allowSharedEdits = true) {
  const shared = vi.fn();
  const localized = vi.fn();
  const element = (value: Partial<EmbedProps>) => (
    <EmbedSettingsForm
      props={value}
      allowSharedEdits={allowSharedEdits}
      updateSharedProps={shared}
      updateLocalizedProps={localized}
    />
  );
  const view = render(element(props));
  return { ...view, shared, localized, refresh: (value: Partial<EmbedProps>) => view.rerender(element(value)) };
}
const input = (label: string) => screen.getByLabelText(label, { exact: true });

const permissions = [
  ['allowScripts', 'scriptsLabel', 'scriptsDescription'],
  ['allowSameOrigin', 'storageLabel', 'storageDescription'],
  ['allowForms', 'formsLabel', 'formsDescription'],
  ['allowDownloads', 'downloadsLabel', 'downloadsDescription'],
  ['allowPopups', 'popupsLabel', 'popupsDescription'],
  ['allowMicrophone', 'microphoneLabel', 'microphoneDescription'],
  ['allowSpeakerSelection', 'speakerSelectionLabel', 'speakerSelectionDescription'],
  ['allowFullscreen', 'fullscreenLabel', 'fullscreenDescription'],
] as const;

describe('Embed settings persistence boundaries', () => {
  it('shows module execution information instead of iframe height and permissions', () => {
    const { refresh } = setup({ uri: 'https://tools-new.dsub.io/embed/index.js' }, false);
    expect(screen.getByText('toolDescription')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'heightModeLabel' })).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(input('urlLabel')).toBeDisabled();
    refresh({ uri: 'https://external.example/page' });
    expect(screen.getByRole('combobox', { name: 'heightModeLabel' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(8);
  });

  it('names each permission and routes its checkbox to the corresponding persisted flag', async () => {
    const { user, shared } = setup({});
    expect(screen.getAllByRole('checkbox')).toHaveLength(8);
    expect(screen.queryByRole('switch')).toBeNull();
    for (const [key, label, description] of permissions) {
      const checkbox = screen.getByRole('checkbox', { name: label });
      expect(checkbox).toHaveAccessibleDescription(description);
      const wasChecked = (checkbox as HTMLInputElement).checked;
      await user.click(checkbox);
      expect(shared).toHaveBeenLastCalledWith({ [key]: wasChecked ? 'false' : 'true' });
    }
  });

  it('keeps incomplete URL draft local and commits only valid HTTPS on blur', async () => {
    const { user, shared, refresh } = setup({ uri: 'https://embed.example' });
    await user.clear(input('urlLabel'));
    await user.type(input('urlLabel'), 'https://');
    await user.tab();
    expect(shared).not.toHaveBeenCalled();
    expect(input('urlLabel')).toHaveValue('https://');
    await user.clear(input('urlLabel'));
    await user.type(input('urlLabel'), 'https://new.example/tool');
    expect(shared).not.toHaveBeenCalled();
    await user.tab();
    expect(shared).toHaveBeenCalledWith({ uri: 'https://new.example/tool' });
    refresh({ uri: 'https://remote.example' });
    expect(input('urlLabel')).toHaveValue('https://remote.example');
  });

  it('does not persist transient empty or out-of-range height', async () => {
    const { user, shared } = setup({ height: '480' });
    for (const value of ['', 'NaN', '10', '99999']) {
      await user.clear(input('heightLabel'));
      if (value) {
        await user.type(input('heightLabel'), value);
      }
      await user.tab();
      expect(input('heightLabel')).toHaveValue('480');
    }
    expect(shared).not.toHaveBeenCalled();
    await user.clear(input('heightLabel'));
    await user.type(input('heightLabel'), '720');
    await user.tab();
    expect(shared).toHaveBeenCalledWith({ height: '720' });
  });

  it('disables every shared control for translators while allowing localized title edits', async () => {
    const { user, shared, localized } = setup({ uri: 'https://embed.example' }, false);
    expect(input('urlLabel')).toBeDisabled();
    expect(input('heightLabel')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'heightModeLabel' })).toBeDisabled();
    for (const control of screen.getAllByRole('checkbox')) {
      expect(control).toBeDisabled();
    }
    await user.click(input('titleLabel'));
    await user.paste('Translated tool');
    expect(localized).toHaveBeenLastCalledWith({ title: 'Translated tool' });
    expect(shared).not.toHaveBeenCalled();
  });
});
