// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { EmbedSettingsForm } from './SettingsForm';
import type { EmbedProps } from './schema';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
const shared = vi.fn();
const localized = vi.fn();
function render(props: Partial<EmbedProps>, allowSharedEdits = true) {
  act(() =>
    root.render(
      <MantineProvider>
        <EmbedSettingsForm
          props={props}
          allowSharedEdits={allowSharedEdits}
          updateSharedProps={shared}
          updateLocalizedProps={localized}
        />
      </MantineProvider>,
    ),
  );
}
function input(label: string) {
  const element = Array.from(container.querySelectorAll('label')).find((item) => item.textContent?.startsWith(label))!;
  return document.getElementById(element.htmlFor) as HTMLInputElement;
}
function type(element: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function blur(element: HTMLInputElement) {
  act(() => element.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
}
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  shared.mockClear();
  localized.mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Embed settings persistence boundaries', () => {
  it('shows module execution information instead of iframe height and permissions, preserving translator title edits', () => {
    render({ uri: 'https://tools-new.dsub.io/embed/index.js' }, false);
    expect(container.textContent).toContain('toolDescription');
    expect(container.textContent).not.toContain('heightModeLabel');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(input('urlLabel').disabled).toBe(true);
    type(input('titleLabel'), 'Localized tool');
    expect(localized).toHaveBeenCalledWith({ title: 'Localized tool' });
    expect(shared).not.toHaveBeenCalled();
    render({ uri: 'https://external.example/page' });
    expect(container.textContent).toContain('heightModeLabel');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(8);
  });
  it('gives every permission a named checkbox and complete accessible description, with clickable labels', () => {
    render({});
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
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(8);
    expect(container.querySelector('[role="switch"]')).toBeNull();
    for (const [key, label, description] of permissions) {
      const checkbox = input(label);
      expect(checkbox).toHaveRole('checkbox');
      expect(checkbox).toHaveAccessibleName(label);
      expect(checkbox).toHaveAccessibleDescription(description);
      const wasChecked = checkbox.checked;
      act(() => checkbox.labels![0].click());
      expect(shared).toHaveBeenLastCalledWith({ [key]: wasChecked ? 'false' : 'true' });
    }
  });

  it('keeps incomplete URL draft local and commits only valid HTTPS on blur', () => {
    render({ uri: 'https://embed.example' });
    type(input('urlLabel'), 'https://');
    blur(input('urlLabel'));
    expect(shared).not.toHaveBeenCalled();
    expect(input('urlLabel').value).toBe('https://');
    type(input('urlLabel'), 'https://new.example/tool');
    expect(shared).not.toHaveBeenCalled();
    blur(input('urlLabel'));
    expect(shared).toHaveBeenCalledWith({ uri: 'https://new.example/tool' });
    render({ uri: 'https://remote.example' });
    expect(input('urlLabel').value).toBe('https://remote.example');
  });
  it('does not persist transient empty or out-of-range height', () => {
    render({ height: '480' });
    for (const value of ['', 'NaN', '10', '99999']) {
      type(input('heightLabel'), value);
      blur(input('heightLabel'));
      expect(input('heightLabel').value).toBe('480');
    }
    expect(shared).not.toHaveBeenCalled();
    type(input('heightLabel'), '720');
    blur(input('heightLabel'));
    expect(shared).toHaveBeenCalledWith({ height: '720' });
  });
  it('disables every shared control for translators while allowing localized title edits', () => {
    render({ uri: 'https://embed.example' }, false);
    expect(input('urlLabel').disabled).toBe(true);
    expect(input('heightLabel').disabled).toBe(true);
    expect(input('heightModeLabel').disabled).toBe(true);
    for (const control of container.querySelectorAll('input[type="checkbox"]')) {
      expect((control as HTMLInputElement).disabled).toBe(true);
      act(() => (control as HTMLInputElement).labels![0].click());
    }
    type(input('titleLabel'), 'Translated tool');
    expect(localized).toHaveBeenCalledWith({ title: 'Translated tool' });
    expect(shared).not.toHaveBeenCalled();
  });
});
