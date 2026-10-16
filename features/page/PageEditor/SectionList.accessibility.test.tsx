// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { localDocumentRoom } from '@/stories/pages/fixtures/document-editor-room';
import { createDefaultSection } from './types';
import { createBlockRoomPageSectionsController } from './block-room-page-sections';
import { PageEditorProvider } from './PageEditorContext';
import { SectionList } from './SectionList';

vi.mock('../blocks/registry', () => ({
  getBlockDefinition: () => undefined,
  getBlockEditor: () => () => <p>Authored content</p>,
}));
vi.mock('@/features/page/blocks/registry', () => ({
  getBlockDefinition: () => undefined,
  getBlockEditor: () => () => <p>Authored content</p>,
}));

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let room: ReturnType<typeof localDocumentRoom> | null = null;
let queryClient: QueryClient | null = null;
afterEach(() => {
  act(() => root?.unmount());
  room?.destroy();
  queryClient?.clear();
  host?.remove();
});
async function renderSections(count: number) {
  room = localDocumentRoom('page', 'en');
  const controller = createBlockRoomPageSectionsController(room.document, 'en');
  for (let i = 1; i < count; i += 1) {
    controller.insert(createDefaultSection('rich-text'), { index: i });
  }
  queryClient = new QueryClient();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root?.render(
      <TestProviders>
        <QueryClientProvider client={queryClient!}>
          <PageEditorProvider
            doc={room!.document}
            provider={room!.provider}
            protocol={room!.protocol}
            locale="en"
            userName="Author"
            pageId="local-page"
            allowStructuralEdits
          >
            <SectionList />
          </PageEditorProvider>
        </QueryClientProvider>
      </TestProviders>,
    ),
  );
  return controller;
}
const settleFocus = () =>
  act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

describe('Page section structural accessibility', () => {
  it('restores deletion focus to the next section, then the previous section, then the insertion command', async () => {
    const controller = await renderSections(3);
    const sectionNodes = () => [...host!.querySelectorAll<HTMLElement>('[data-page-section-id]')];
    const initial = sectionNodes().map((node) => node.dataset.pageSectionId!);
    const remove = (index: number) => {
      const button = sectionNodes()[index]!.querySelector<HTMLButtonElement>('button[aria-label^="Delete"]')!;
      act(() => {
        button.focus();
        button.click();
      });
    };
    remove(0);
    await settleFocus();
    expect(controller.read().map((section) => section.id)).toEqual(initial.slice(1));
    expect(sectionNodes()[0]!.querySelector('[data-page-section-toggle]')).toHaveFocus();
    expect(sectionNodes()[0]).toHaveAccessibleName('Rich Text');
    expect(sectionNodes()[0]).toHaveAccessibleDescription('Rich Text · 1/2');
    remove(1);
    await settleFocus();
    expect(sectionNodes()[0]!.querySelector('[data-page-section-toggle]')).toHaveFocus();
    remove(0);
    await settleFocus();
    expect(host!.querySelector('[data-page-section-add]')).toHaveFocus();
    expect(controller.read()).toHaveLength(0);
    expect(host!.querySelector('[role="status"]')).toHaveTextContent('Rich Text deleted');
  });

  it('names the disclosure content after its section independently of expanded/collapsed command wording', async () => {
    await renderSections(1);
    const section = host!.querySelector<HTMLElement>('[data-page-section-id]')!;
    const toggle = section.querySelector<HTMLButtonElement>('[data-page-section-toggle]')!;
    // Rich-text sections start expanded (their SSR body stays visible through the editor handoff).
    const panel = host!.querySelector(`#${toggle.getAttribute('aria-controls')}`)!;
    expect(panel).toHaveAccessibleName('Rich Text · 1/1');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Collapse Rich Text section');
    expect(section).toHaveAccessibleName('Rich Text');
    act(() => toggle.click());
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName('Expand Rich Text section');
    expect(section).toHaveAccessibleName('Rich Text');
  });
});
