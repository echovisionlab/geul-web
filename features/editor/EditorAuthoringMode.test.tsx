// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  useEditorAuthoringMode,
  useOptionalEditorAuthoringMode,
  type EditorAuthoringMode,
} from './EditorAuthoringMode';

let latest: { required: EditorAuthoringMode; optional: EditorAuthoringMode | null } | null = null;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function Harness() {
  latest = {
    required: useEditorAuthoringMode(),
    optional: useOptionalEditorAuthoringMode(),
  };
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  latest = null;
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  latest = null;
});

function render(children: ReactNode) {
  act(() => root?.render(children));
  expect(latest).not.toBeNull();
  return latest!;
}

describe('EditorAuthoringMode context', () => {
  it('preserves the established permissive default for the required hook', () => {
    const hooks = render(<Harness />);

    expect(hooks.required).toMatchObject({
      allowNeutralBlockEdits: true,
      allowLocalizedBlockEdits: true,
    });
  });

  it('fails closed for the optional hook when no provider owns mutation authority', () => {
    const hooks = render(<Harness />);

    expect(hooks.optional).toBeNull();
  });
});
