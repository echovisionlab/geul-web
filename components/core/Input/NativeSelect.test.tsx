// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
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
      <MantineProvider>
        <NativeSelect label="Language" data={['English', 'Korean']} animate={animate} />
      </MantineProvider>,
    );
  });
}

describe('NativeSelect', () => {
  it('uses the shared underline input and animated wrapper styles', () => {
    renderNativeSelect();

    expect(container.querySelector('select')?.classList.contains(classes.input)).toBe(true);
    expect(container.querySelector(`.${classes.wrapper}`)).not.toBeNull();
  });

  it('keeps the underline style while allowing focus animation to be disabled', () => {
    renderNativeSelect(false);

    expect(container.querySelector('select')?.classList.contains(classes.input)).toBe(true);
    expect(container.querySelector(`.${classes.wrapper}`)).toBeNull();
  });
});
