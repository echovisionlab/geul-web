// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { DocumentEditorPanels } from './DocumentEditorPanels';

const screen = vi.hoisted(() => ({ mobile: true }));
vi.mock('@mantine/hooks', () => ({ useMediaQuery: () => screen.mobile }));
let host: HTMLDivElement;
let root: Root;
function Draft() {
  const [edits, setEdits] = useState(0);
  return (
    <button type="button" onClick={() => setEdits(edits + 1)}>
      Draft edits: {edits}
    </button>
  );
}
function render(focused = false) {
  act(() =>
    root.render(
      <TestProviders>
        <DocumentEditorPanels focused={focused} settings={<p>Document settings</p>}>
          <Draft />
        </DocumentEditorPanels>
      </TestProviders>,
    ),
  );
}
beforeEach(() => {
  screen.mobile = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('DocumentEditorPanels', () => {
  it('opens writing first and preserves the mounted draft across settings changes', () => {
    render();
    const tabs = Array.from(host.querySelectorAll<HTMLElement>('[role="tab"]'));
    const body = tabs.find((tab) => tab.textContent === 'Body');
    const settings = tabs.find((tab) => tab.textContent === 'Settings');
    expect(body).toHaveAttribute('aria-selected', 'true');
    const draft = host.querySelector<HTMLButtonElement>('button');
    act(() => draft?.click());
    expect(draft?.textContent).toBe('Draft edits: 1');
    act(() => settings?.click());
    expect(settings).toHaveAttribute('aria-selected', 'true');
    act(() => body?.click());
    expect(host.querySelector('button')).toBe(draft);
    expect(draft?.textContent).toBe('Draft edits: 1');
  });
  it('puts the writing surface first and the settings in a labelled column on wide screens', () => {
    screen.mobile = false;
    render();
    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(host.textContent).toBe('Draft edits: 0Document settings');
    expect(host.querySelector('aside')?.getAttribute('aria-label')).toBeTruthy();
  });
  it('shows only writing in focused mode', () => {
    render(true);
    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(host.textContent).toBe('Draft edits: 0');
  });
});
