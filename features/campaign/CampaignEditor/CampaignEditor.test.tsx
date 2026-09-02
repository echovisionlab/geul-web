// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampaignEditor } from './CampaignEditor';

const profileProps: Array<Record<string, unknown>> = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/features/editor/tiptap/profiles/EmailTiptapEditor', () => ({
  EmailTiptapEditor: (props: Record<string, unknown>) => {
    profileProps.push(props);
    return <div data-testid="campaign-tiptap-editor" data-editable={String(props.editable)} />;
  },
}));

describe('CampaignEditor', () => {
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
    const provider = { awareness: {} };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() =>
      root?.render(
        <CampaignEditor
          campaignId="campaign-1"
          provider={provider as never}
          blockRoomController={controller as never}
        />,
      ),
    );

    expect(container.querySelector('[data-testid="campaign-tiptap-editor"]')).not.toBeNull();
    expect(profileProps[0]?.blockRoomController).toBe(controller);
    expect(profileProps[0]).not.toHaveProperty('fragment');
  });

  it('passes an explicit read-only state to the editor profile', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() =>
      root?.render(
        <CampaignEditor
          campaignId="campaign-1"
          provider={{ awareness: {} } as never}
          blockRoomController={{} as never}
          editable={false}
        />,
      ),
    );

    expect(container.querySelector('[data-testid="campaign-tiptap-editor"]')?.getAttribute('data-editable')).toBe(
      'false',
    );
  });
});
