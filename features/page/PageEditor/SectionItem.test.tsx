// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { BlockSettingsSurfaceProps } from '../blocks/types';
import type { SectionMeta } from './types';

const pageEditorContext = vi.hoisted(() => ({
  mergeSection: vi.fn((section: SectionMeta) => section),
  updateLocalizedSectionProps: vi.fn(),
  updateSection: vi.fn(),
}));

const mockRegistry = vi.hoisted(() => ({
  getBlockDefinition: vi.fn(() => ({})),
  getBlockEditor: vi.fn(),
}));

function MockBlockEditor() {
  return <div data-testid="mock-block-editor" />;
}

function MockCanvasPreview() {
  return <div data-testid="mock-canvas-preview" />;
}

function MockSettingsEditor() {
  return <div data-testid="mock-settings-editor" />;
}

function MockSettingsSurface({ opened, title, onClose }: BlockSettingsSurfaceProps) {
  return opened ? (
    <div data-testid="mock-settings-surface">
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        Close dedicated settings
      </button>
    </div>
  ) : null;
}

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.section ? `${key}:${values.section}` : key,
}));

vi.mock('@/features/page/PageEditor/PageEditorContext', () => ({
  usePageEditor: () => pageEditorContext,
}));

vi.mock('../blocks/registry', () => mockRegistry);
vi.mock('@/features/page/blocks/registry', () => mockRegistry);

let SectionItem: typeof import('./SectionItem').SectionItem;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderSection(section: SectionMeta) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <MantineProvider>
        <SectionItem section={section} onDelete={vi.fn()} />
      </MantineProvider>,
    );
  });
}

beforeEach(async () => {
  ({ SectionItem } = await import('./SectionItem'));
  pageEditorContext.mergeSection.mockImplementation((section: SectionMeta) => section);
  pageEditorContext.updateLocalizedSectionProps.mockReset();
  pageEditorContext.updateSection.mockReset();
  mockRegistry.getBlockDefinition.mockReturnValue({});
  mockRegistry.getBlockEditor.mockReturnValue(MockBlockEditor);
  container = null;
  root = null;
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  document.body.innerHTML = '';
  root = null;
  container = null;
});

describe('SectionItem', () => {
  const styledSettings = {
    backgroundColor: '#123456',
    paddingTop: '12',
    paddingBottom: '16',
    paddingLeft: '20',
    paddingRight: '24',
    maxWidth: 'narrow',
  } as const;

  const nonSplitSections: Array<{ type: 'rich-text' | 'columns'; section: SectionMeta }> = [
    {
      type: 'rich-text',
      section: {
        id: 'section-rich-text',
        type: 'rich-text',
        settings: styledSettings,
      } satisfies SectionMeta,
    },
    {
      type: 'columns',
      section: {
        id: 'section-columns',
        type: 'columns',
        props: {
          columns: '2',
          gap: '24',
          columnRatios: '1:1',
          mobileStack: 'true',
        },
        columns: [],
        settings: styledSettings,
      } satisfies SectionMeta,
    },
  ];

  it.each(nonSplitSections)('applies section style to non-split $type editor preview content', ({ type, section }) => {
    renderSection(section);

    const toggle = container?.querySelector<HTMLButtonElement>('[data-page-section-toggle]');
    expect(toggle).toBeTruthy();

    act(() => {
      toggle?.click();
    });

    const preview = container?.querySelector<HTMLElement>('[data-page-section-editor-preview]');
    expect(preview).toBeTruthy();
    expect(preview?.dataset.sectionType).toBe(type);
    expect(preview?.style.paddingTop).toBe('12px');
    expect(preview?.style.paddingBottom).toBe('16px');
    expect(preview?.style.paddingLeft).toBe('20px');
    expect(preview?.style.paddingRight).toBe('24px');
    expect(preview?.style.maxWidth).toBe('800px');
    expect(preview?.style.marginLeft).toBe('auto');
    expect(preview?.style.marginRight).toBe('auto');
    expect(container?.querySelector('[data-testid="mock-block-editor"]')).toBeTruthy();
  });

  it('opens a block-specific settings workspace when one is registered', () => {
    mockRegistry.getBlockDefinition.mockReturnValue({
      CanvasPreview: MockCanvasPreview,
      SettingsEditor: MockSettingsEditor,
      SettingsSurface: MockSettingsSurface,
    });
    renderSection({
      id: 'section-scene',
      type: 'immersive-scene',
      settings: styledSettings,
      props: {},
    });

    const openSettings = container?.querySelector<HTMLButtonElement>(
      '[aria-label^="sectionItem.actions.openSettings"]',
    );
    expect(openSettings).toBeTruthy();

    act(() => {
      openSettings?.click();
    });

    expect(container?.querySelector('[data-testid="mock-settings-surface"]')).toBeTruthy();
    expect(container?.querySelector('[data-testid="mock-settings-editor"]')).toBeFalsy();

    const closeSettings = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Close dedicated settings',
    );
    act(() => {
      closeSettings?.click();
    });
    expect(container?.querySelector('[data-testid="mock-settings-surface"]')).toBeFalsy();
  });
});
