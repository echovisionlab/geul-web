// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { IconViewModeControl } from './IconViewModeControl';

let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function Modes() {
  const [mode, setMode] = useState<'split' | 'code' | 'preview'>('split');
  return (
    <IconViewModeControl
      value={mode}
      onChange={setMode}
      options={[
        { value: 'split', tooltip: 'Split', icon: <svg data-testid="split-icon" /> },
        { value: 'code', tooltip: 'Code', icon: <svg data-testid="code-icon" /> },
        { value: 'preview', tooltip: 'Preview', icon: <svg data-testid="preview-icon" /> },
      ]}
    />
  );
}

describe('icon view modes', () => {
  it('names the actual radio choices while preserving the icon-only layout and confirmed selection', async () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () =>
      root.render(
        <TestProviders>
          <Modes />
        </TestProviders>,
      ),
    );
    const choices = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(host.querySelector('[role="radiogroup"]')).toHaveAccessibleName('View');
    expect(choices.map((choice) => choice.getAttribute('aria-label'))).toEqual(['Split', 'Code', 'Preview']);
    expect(choices[0].checked).toBe(true);
    expect(host.querySelector('div[aria-label]:not([role])')).toBeNull();
    // Core owns the square icon segment and glyph size; the feature supplies no inline geometry.
    expect(host.querySelectorAll('[data-geul-segment-kind="icon"]')).toHaveLength(3);
    for (const icon of host.querySelectorAll('[data-testid$="-icon"]')) {
      expect(icon.closest('[data-geul-segment-kind="icon"] [style]')).toBeNull();
    }
    await act(async () => choices[1].click());
    expect(choices[1].checked).toBe(true);
    expect(choices[0].checked).toBe(false);
    expect(host.textContent).not.toMatch(/Split|Code|Preview/);
  });
});
