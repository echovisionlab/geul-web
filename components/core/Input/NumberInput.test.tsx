// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import classes from './Input.module.css';
import { NumberInput } from './NumberInput';

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

describe('NumberInput', () => {
  it('uses the shared underline and focus-animation styles', () => {
    act(() => {
      root.render(
        <MantineProvider>
          <NumberInput label="Order" defaultValue={1} />
        </MantineProvider>,
      );
    });

    expect(container.querySelector('input')?.classList.contains(classes.input)).toBe(true);
    expect(container.querySelector(`.${classes.wrapper}`)).not.toBeNull();
  });
});
