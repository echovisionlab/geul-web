// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NativeSelect } from './NativeSelect';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('NativeSelect', () => {
  it('preserves the required field name and only references rendered help and error copy', () => {
    act(() =>
      root.render(
        <>
          <span id="external-help">Choose your language</span>
          <NativeSelect
            label="Language"
            required
            description="Translation source"
            error
            aria-describedby="external-help"
            data={['English', 'Korean']}
          />
        </>,
      ),
    );
    const select = container.querySelector('select')!;
    expect(select).toHaveAccessibleName('Language');
    expect(select).toHaveAccessibleDescription('Choose your language Translation source');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toBeRequired();
    for (const id of select.getAttribute('aria-describedby')!.split(/\s+/)) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(container.querySelector('label')?.textContent).toBe('Language *');
  });
});
