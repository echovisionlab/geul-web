// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailTemplateEditor } from './EmailTemplateEditor';

const profileProps: Array<Record<string, unknown>> = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/features/editor/tiptap/profiles/EmailTiptapEditor', () => ({
  EmailTiptapEditor: (props: Record<string, unknown>) => {
    profileProps.push(props);
    return <div data-testid="email-tiptap-editor" data-editable={String(props.editable)} />;
  },
}));

describe('EmailTemplateEditor', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    profileProps.length = 0;
  });

  it('passes only the typed Block-room controller to the email profile', () => {
    const controller = { initialContent: { type: 'doc', content: [] } };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() =>
      root?.render(
        <EmailTemplateEditor
          templateId="template-1"
          provider={{ awareness: {} } as never}
          blockRoomController={controller as never}
        />,
      ),
    );

    expect(container.querySelector('[data-testid="email-tiptap-editor"]')).not.toBeNull();
    expect(profileProps[0]?.blockRoomController).toBe(controller);
    expect(profileProps[0]).not.toHaveProperty('fragment');
    expect(profileProps[0]?.availableVariables).toBeUndefined();
  });

  it('passes an explicit read-only state to the editor profile', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() =>
      root?.render(
        <EmailTemplateEditor
          templateId="template-1"
          provider={{ awareness: {} } as never}
          blockRoomController={{} as never}
          editable={false}
        />,
      ),
    );

    expect(container.querySelector('[data-testid="email-tiptap-editor"]')?.getAttribute('data-editable')).toBe('false');
  });
});
