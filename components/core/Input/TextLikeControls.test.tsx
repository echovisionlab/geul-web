// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ColorInput } from './ColorInput';
import { FileInput } from './FileInput';
import classes from './Input.module.css';
import { TagsInput } from './TagsInput';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

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

describe('text-like Core inputs', () => {
  it('share the underline and focus-animation classes', () => {
    act(() => {
      root.render(
        <MantineProvider>
          <ColorInput label="Color" />
          <FileInput label="File" />
          <TagsInput label="Tags" />
        </MantineProvider>,
      );
    });

    expect(container.querySelectorAll(`.${classes.input}`)).toHaveLength(3);
    expect(container.querySelectorAll(`.${classes.wrapper}`)).toHaveLength(3);
  });
});
