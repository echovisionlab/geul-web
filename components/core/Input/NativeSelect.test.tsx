// @vitest-environment jsdom

import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import classes from './Input.module.css';
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

function renderNativeSelect(animate = true) {
  act(() => {
    root.render(
      <DesignSystemProvider>
        <NativeSelect label="Language" data={['English', 'Korean']} animate={animate} />
      </DesignSystemProvider>,
    );
  });
}

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

  it('provides a decorative dropdown affordance and renders input accessories', () => {
    act(() =>
      root.render(<NativeSelect label="Language" data={['English']} leftSection={<span>Language icon</span>} />),
    );
    expect(container.querySelector(`.${classes.nativeSelectIndicator} svg`)).not.toBeNull();
    expect(container.querySelector(`.${classes.nativeSelectIndicator}`)?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector(`.${classes.section}`)?.textContent).toBe('Language icon');
    expect(container.querySelectorAll('select')).toHaveLength(1);
    expect(container.querySelector('button')).toBeNull();
  });
  it('uses the shared underline input and animated wrapper styles', () => {
    renderNativeSelect();

    expect(container.querySelector('select')?.classList.contains(classes.input)).toBe(true);
    expect(container.querySelector(`.${classes.wrapper}`)).not.toBeNull();
  });

  it('keeps the underline style while allowing focus animation to be disabled', () => {
    renderNativeSelect(false);

    expect(container.querySelector('select')?.classList.contains(classes.input)).toBe(true);
    expect(container.querySelector(`.${classes.wrapper}`)).not.toBeNull();
  });
});
