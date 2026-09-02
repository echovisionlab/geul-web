// @vitest-environment jsdom

import { act, type HTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { NodeViewProps } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMapInteractionOptions } from '@/features/map/utils/interaction-options';
import type { TiptapMapSelectionMenuBinding, TiptapMapSelectionMenuRegistry } from '../menus/map-external';
import { TiptapMapNodeView, type TiptapMapNodeOptions } from './TiptapMapNodeView';

const mapEditorSpy = vi.hoisted(() => ({
  props: null as {
    config: {
      draggable: boolean;
      zoomable: boolean;
      rotatable: boolean;
      tiltable: boolean;
    };
    interactive: boolean;
  } | null,
}));

const dispatch = vi.fn();
const neutralPatch = vi.fn();
const deleteBlockCallback = vi.fn();
const unregisterMenu = vi.fn();
const openPlacesModal = vi.fn();
const transactionDelete = vi.fn();
const transactionSetSelection = vi.fn();
const editorFocus = vi.fn();
const updateAttributesSpy = vi.fn();
let resizeDirection: 'left' | 'right' | null = null;
let registeredBinding: TiptapMapSelectionMenuBinding | undefined;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  ReactNodeViewRenderer: vi.fn(),
}));
vi.mock('../useExactTiptapNodeSelection', () => ({
  useExactTiptapNodeSelection: ({ editor }: { editor: { exactNodeSelected?: boolean } }) =>
    editor.exactNodeSelected ?? false,
}));
vi.mock('@tiptap/pm/state', () => ({
  NodeSelection: { create: vi.fn(() => ({ type: 'node' })) },
  Selection: { near: vi.fn(() => ({ type: 'near' })) },
}));
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data:
      queryKey[0] === 'mapPlace'
        ? Array.isArray(queryKey[2]) && queryKey[2].length > 0
          ? [{ id: 'place-1', name: 'Seoul', address: 'Korea', lat: 37.5, lng: 127, imageUrl: null }]
          : []
        : { themes: [] },
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/core', () => ({
  Box: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Stack: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
vi.mock('@mantine/hooks', () => ({ useDisclosure: () => [false, { open: openPlacesModal, close: vi.fn() }] }));
vi.mock('@/components/core/Input', () => ({
  TextInput: ({ classNames, ...props }: HTMLAttributes<HTMLInputElement> & { classNames?: { input?: string } }) => (
    <input className={classNames?.input} {...props} />
  ),
}));
vi.mock('@/features/place/PlacesManageModal', () => ({ PlacesManageModal: () => null }));
vi.mock('@/features/map/MapLibreMapEditor', () => ({
  MapLibreMapEditor: ({
    config,
    places,
    interactive,
    onConfigChange,
    onManagePlaces,
    levaProps,
  }: {
    config: {
      draggable: boolean;
      zoomable: boolean;
      rotatable: boolean;
      tiltable: boolean;
    };
    places: { id: string }[];
    interactive: boolean;
    onConfigChange: (patch: { zoom?: number; draggable?: boolean }) => void;
    onManagePlaces?: () => void;
    levaProps?: { hidden?: boolean };
  }) => {
    mapEditorSpy.props = { config, interactive };
    return (
      <div
        data-map-place-count={places.length}
        data-interactive={interactive}
        data-has-place-management={Boolean(onManagePlaces)}
        data-leva-hidden={levaProps?.hidden}
        data-config-draggable={config.draggable}
        data-config-zoomable={config.zoomable}
        data-config-rotatable={config.rotatable}
        data-config-tiltable={config.tiltable}
      >
        <span className="maplibregl-ctrl-attrib">Map attribution</span>
        <span data-map-label>Map label</span>
        <button type="button" data-map-settings>
          Map settings
        </button>
        <button type="button" data-map-config-change onClick={() => onConfigChange({ zoom: 11 })}>
          change map
        </button>
        <button type="button" data-enable-map-drag onClick={() => onConfigChange({ draggable: true })}>
          enable drag
        </button>
      </div>
    );
  },
}));
vi.mock('@/features/editor/ui/EditorMediaBlockShell', () => ({
  EditorMediaBlockFrame: ({
    allowResize,
    children,
    isResizing,
    selected,
    suppressStaticTextSelection,
  }: {
    allowResize: boolean;
    children: React.ReactNode;
    isResizing?: boolean;
    selected?: boolean;
    suppressStaticTextSelection?: boolean;
  }) => (
    <div
      data-map-frame
      data-allow-resize={allowResize}
      data-resizing={isResizing || undefined}
      data-selected={selected || undefined}
      data-suppress-static-text-selection={suppressStaticTextSelection || undefined}
    >
      {children}
    </div>
  ),
}));
vi.mock('@/features/editor/hooks/useBlockResize', () => ({
  useBlockResize: () => ({
    widthPercent: 100,
    isDragging: resizeDirection,
    startResizeLeft: vi.fn(),
    startResizeRight: vi.fn(),
    onResizeKeyDown: vi.fn(),
    onResizeBlur: vi.fn(),
    getMarginStyle: () => undefined,
  }),
}));
vi.mock('@/lib/contexts/MapPlaceActionContext', () => ({ useCreateMapPlaceForBlockAction: () => vi.fn() }));
vi.mock('../wire-schema', () => ({ WireMap: { extend: vi.fn() } }));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(
  attrs: Record<string, unknown>,
  options: TiptapMapNodeOptions = {},
  selected = false,
  editorEditable = true,
) {
  let currentAttrs = attrs;
  let currentOptions = options;
  const transaction = {
    setNodeMarkup: vi.fn(() => transaction),
    delete: transactionDelete.mockImplementation(() => transaction),
    setSelection: transactionSetSelection.mockImplementation(() => transaction),
    scrollIntoView: vi.fn(() => transaction),
    doc: { resolve: vi.fn(() => ({ position: 2 })), content: { size: 20 } },
  };
  const editor = {
    isEditable: editorEditable,
    exactNodeSelected: selected,
    state: {
      doc: {
        resolve: (position: number) =>
          position === 3
            ? { parent: { attrs: { id: 'map-block' }, type: { name: 'blockContainer' } }, before: () => 2 }
            : { parent: { type: { name: 'blockGroup' }, childCount: 2 }, depth: 1 },
        nodeAt: (position: number) =>
          position === 2 ? { nodeSize: 5 } : position === 3 ? { type: { name: 'map' } } : null,
      },
      tr: transaction,
    },
    view: { dispatch, focus: editorFocus },
    commands: { focus: editorFocus },
    on: vi.fn(),
    off: vi.fn(),
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const renderCurrent = () => {
    const nodeViewProps = {
      editor,
      getPos: () => 3,
      node: { attrs: currentAttrs },
      selected,
      updateAttributes: (patch: Record<string, unknown>) => {
        updateAttributesSpy(patch);
        currentAttrs = { ...currentAttrs, ...patch };
        renderCurrent();
      },
    } as unknown as NodeViewProps;
    root?.render(<TiptapMapNodeView {...nodeViewProps} {...currentOptions} />);
  };
  act(renderCurrent);
  return {
    rerender(nextOptions: TiptapMapNodeOptions, nextEditorEditable = editor.isEditable) {
      editor.isEditable = nextEditorEditable;
      currentOptions = nextOptions;
      act(renderCurrent);
    },
  };
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  dispatch.mockReset();
  neutralPatch.mockReset();
  deleteBlockCallback.mockReset();
  unregisterMenu.mockReset();
  openPlacesModal.mockReset();
  transactionDelete.mockReset();
  transactionSetSelection.mockReset();
  editorFocus.mockReset();
  updateAttributesSpy.mockReset();
  registeredBinding = undefined;
  mapEditorSpy.props = null;
  resizeDirection = null;
});

describe('TiptapMapNodeView', () => {
  it('leaves map pointer selection to the Tiptap NodeView owner', () => {
    render({ mapPlaceIds: 'place-1', previewWidth: '100' });

    const mapNode = container?.querySelector<HTMLElement>('[data-content-type="map"]');
    const event = new MouseEvent('mousedown', { bubbles: true, button: 0, cancelable: true });
    act(() => mapNode?.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    expect(transactionSetSelection).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(editorFocus).not.toHaveBeenCalled();
  });

  it('renders and updates a full map canvas without requiring a place', () => {
    render(
      { mapPlaceIds: '', previewWidth: '100', centerLat: '37.5', centerLng: '127' },
      { onNeutralAttrsChange: neutralPatch },
    );

    expect(container?.querySelector('[data-map-place-count="0"]')).toBeTruthy();
    expect(container?.querySelector('[data-testid="tiptap-map-empty"]')).toBeNull();
    act(() => container?.querySelector<HTMLButtonElement>('[data-map-config-change]')?.click());
    expect(neutralPatch).toHaveBeenCalledWith(
      'map-block',
      expect.objectContaining({ mapPlaceIds: '', centerLat: '37.5', centerLng: '127' }),
      { zoom: '11' },
    );
  });

  it('normalizes legacy map attributes before authoring renders the existing document', () => {
    render({
      mapPlaceId: 'place-1',
      location: JSON.stringify({ name: 'Seoul', lat: 37.5, lng: 127 }),
      previewWidth: '100',
    });

    expect(container?.querySelector('[data-map-place-count="1"]')).toBeTruthy();
    expect(mapEditorSpy.props?.config).toEqual(
      expect.objectContaining({
        center: { lat: 37.5, lng: 127 },
      }),
    );
  });

  it('renders selected places as an editable map and mirrors structural patches', () => {
    render(
      { mapPlaceIds: 'place-1', previewWidth: '100', aspectRatio: '16:9', caption: '' },
      { onNeutralAttrsChange: neutralPatch },
    );

    expect(container?.querySelector('[data-map-place-count="1"]')).toBeTruthy();
    expect(container?.querySelector('[data-interactive="true"]')).toBeTruthy();
    act(() => container?.querySelector<HTMLButtonElement>('[data-map-config-change]')?.click());
    expect(neutralPatch).toHaveBeenCalledWith('map-block', expect.objectContaining({ mapPlaceIds: 'place-1' }), {
      zoom: '11',
    });
  });

  it('projects stored flags to the exact MapLibre handlers and updates dragPan live', () => {
    render({
      mapPlaceIds: 'place-1',
      previewWidth: '100',
      aspectRatio: '16:9',
      draggable: 'false',
      zoomable: 'false',
      rotatable: 'true',
      tiltable: 'true',
    });

    const map = container?.querySelector<HTMLElement>('[data-map-place-count="1"]');
    expect(map?.getAttribute('data-interactive')).toBe('true');
    expect(map?.getAttribute('data-config-draggable')).toBe('false');
    expect(map?.getAttribute('data-config-zoomable')).toBe('false');
    expect(map?.getAttribute('data-config-rotatable')).toBe('true');
    expect(map?.getAttribute('data-config-tiltable')).toBe('true');
    expect(mapEditorSpy.props?.interactive).toBe(true);
    expect(mapEditorSpy.props?.config).toEqual(
      expect.objectContaining({
        draggable: false,
        zoomable: false,
        rotatable: true,
        tiltable: true,
      }),
    );
    expect({
      dragPan: mapEditorSpy.props?.config.draggable,
      dragRotate: mapEditorSpy.props?.config.rotatable,
      touchPitch: mapEditorSpy.props?.config.tiltable,
      pitchWithRotate: mapEditorSpy.props?.config.tiltable,
      ...getMapInteractionOptions(mapEditorSpy.props?.config ?? {}),
    }).toEqual({
      dragPan: false,
      scrollZoom: false,
      touchZoomRotate: false,
      doubleClickZoom: false,
      keyboard: true,
      dragRotate: true,
      touchPitch: true,
      pitchWithRotate: true,
    });

    act(() => container?.querySelector<HTMLButtonElement>('[data-enable-map-drag]')?.click());
    expect(updateAttributesSpy).toHaveBeenCalledWith({ draggable: 'true' });
    expect(map?.getAttribute('data-config-draggable')).toBe('true');
    expect(mapEditorSpy.props?.config.draggable).toBe(true);
    expect(getMapInteractionOptions(mapEditorSpy.props?.config ?? {})).toEqual({
      scrollZoom: false,
      touchZoomRotate: false,
      doubleClickZoom: false,
      keyboard: true,
    });
  });

  it('uses the same durable interaction projection in read-only mode while hard-gating settings writes', () => {
    render(
      {
        mapPlaceIds: 'place-1',
        previewWidth: '100',
        aspectRatio: '16:9',
        draggable: 'false',
        zoomable: 'true',
        rotatable: 'false',
        tiltable: 'true',
      },
      { allowNeutralBlockEdits: false, allowLocalizedBlockEdits: false },
      false,
      false,
    );

    const map = container?.querySelector<HTMLElement>('[data-map-place-count="1"]');
    expect(map?.getAttribute('data-interactive')).toBe('true');
    expect(map?.getAttribute('data-config-draggable')).toBe('false');
    expect(map?.getAttribute('data-config-zoomable')).toBe('true');
    expect(map?.getAttribute('data-config-rotatable')).toBe('false');
    expect(map?.getAttribute('data-config-tiltable')).toBe('true');
    act(() => container?.querySelector<HTMLButtonElement>('[data-enable-map-drag]')?.click());
    expect(updateAttributesSpy).not.toHaveBeenCalled();
  });

  it('passes Tiptap selection to the resize frame', () => {
    resizeDirection = 'right';
    render({ mapPlaceIds: 'place-1', previewWidth: '100', aspectRatio: '16:9', caption: '' }, {}, true);

    expect(container?.querySelector('[data-map-frame][data-selected="true"]')).toBeTruthy();
    expect(container?.querySelector('[data-map-frame][data-resizing="true"]')).toBeTruthy();
  });

  it('keeps the selected static map surface separate from the text-selectable caption editor', () => {
    render({ mapPlaceIds: 'place-1', previewWidth: '100', aspectRatio: '16:9', caption: '' }, {}, true);

    const staticSurface = container?.querySelector<HTMLElement>('[data-map-static-surface]');
    const caption = container?.querySelector<HTMLButtonElement>('[data-testid="tiptap-map-caption"]');
    expect(staticSurface).toBeTruthy();
    expect(caption).toBeTruthy();
    expect(caption?.hasAttribute('data-editor-media-caption')).toBe(false);
    expect(container?.querySelector('[data-map-frame]')?.getAttribute('data-suppress-static-text-selection')).toBe(
      'true',
    );
    expect(staticSurface?.querySelector('.maplibregl-ctrl-attrib')).toBeTruthy();
    expect(staticSurface?.querySelector('[data-map-label]')).toBeTruthy();
    expect(staticSurface?.querySelector('[data-map-settings]')).toBeTruthy();
    expect(staticSurface?.contains(caption ?? null)).toBe(false);

    act(() => caption?.click());
    const captionInput = container?.querySelector<HTMLInputElement>('input');
    expect(captionInput).toBeTruthy();
    expect(staticSurface?.contains(captionInput ?? null)).toBe(false);
  });

  it('hides read-only authoring controls while preserving durable map interactions', () => {
    render(
      { mapPlaceIds: 'place-1', previewWidth: '100', aspectRatio: '16:9', caption: '' },
      {
        allowNeutralBlockEdits: false,
        allowLocalizedBlockEdits: false,
      },
    );

    expect(container?.querySelector('[data-interactive="true"]')).toBeTruthy();
    expect(container?.querySelector('[data-leva-hidden="true"]')).toBeTruthy();
    expect(container?.querySelector('[data-has-place-management="false"]')).toBeTruthy();
    expect(container?.querySelector('[data-map-frame][data-allow-resize="false"]')).toBeTruthy();
    expect(container?.querySelector('[data-map-config-change]')).toBeTruthy();
    act(() => container?.querySelector<HTMLButtonElement>('[data-map-config-change]')?.click());
    expect(dispatch).not.toHaveBeenCalled();
    expect(container?.textContent).not.toContain('clickToAddCaption');
    expect(container?.querySelector('[data-testid="tiptap-map-caption"]')).toBeNull();
  });

  it('keeps the selected read-only display caption inside static selection suppression', () => {
    const mounted = render(
      { mapPlaceIds: 'place-1', previewWidth: '100', aspectRatio: '16:9', caption: 'Seoul map' },
      { allowNeutralBlockEdits: false, allowLocalizedBlockEdits: false },
      true,
    );
    mounted.rerender({ allowNeutralBlockEdits: false, allowLocalizedBlockEdits: false }, false);

    const caption = [...(container?.querySelectorAll<HTMLElement>('div') ?? [])].find(
      (element) => element.textContent === 'Seoul map' && element.children.length === 0,
    );
    expect(caption).toBeTruthy();
    expect(caption?.tagName).not.toBe('BUTTON');
    expect(caption?.hasAttribute('data-editor-media-caption')).toBe(false);
    expect(container?.querySelector('[data-content-type="map"]')?.hasAttribute('data-selected')).toBe(false);
    expect(container?.querySelector('[data-map-frame]')?.hasAttribute('data-selected')).toBe(false);
  });

  it('ANDs localized and neutral permissions with the editor editable state', () => {
    render(
      { mapPlaceIds: 'place-1', previewWidth: '100', aspectRatio: '16:9', caption: 'Seoul' },
      { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true },
      true,
      false,
    );

    expect(container?.querySelector('[data-interactive="true"]')).toBeTruthy();
    expect(container?.querySelector('[data-leva-hidden="true"]')).toBeTruthy();
    expect(container?.querySelector('[data-map-frame][data-allow-resize="false"]')).toBeTruthy();
    expect(container?.querySelector('[data-testid="tiptap-map-caption"]')).toBeNull();
    expect(container?.querySelector('input')).toBeNull();
    act(() => container?.querySelector<HTMLButtonElement>('[data-map-config-change]')?.click());
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('renders a full read-only map without a place or place activation placeholder', () => {
    render({ mapPlaceIds: '', previewWidth: '100' }, { allowNeutralBlockEdits: true }, false, false);

    expect(container?.querySelector('[data-map-place-count="0"]')).toBeTruthy();
    expect(container?.querySelector('[data-testid="tiptap-map-empty"]')).toBeNull();
    expect(container?.querySelector('[data-interactive="true"]')).toBeTruthy();
  });

  it('uses a native button to activate localized caption editing', () => {
    render({ mapPlaceIds: 'place-1', previewWidth: '100', aspectRatio: '16:9', caption: '' });

    const caption = container?.querySelector<HTMLButtonElement>('[data-testid="tiptap-map-caption"]');
    expect(caption?.tagName).toBe('BUTTON');
    expect(caption?.type).toBe('button');
    act(() => caption?.click());
    expect(container?.querySelector('input')).toBeTruthy();
  });

  it('registers private map commands with the supplied editor-local menu registry and unregisters on unmount', () => {
    const register = vi.fn((registeredBlockId: string, binding: TiptapMapSelectionMenuBinding) => {
      expect(registeredBlockId).toBe('map-block');
      registeredBinding = binding;
      return unregisterMenu;
    });
    const registry: TiptapMapSelectionMenuRegistry = {
      register,
      get: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    };
    render(
      {
        mapPlaceIds: 'place-1',
        previewWidth: '72',
        textAlignment: 'center',
        aspectRatio: '16:9',
        caption: '',
      },
      {
        selectionMenuRegistry: registry,
        onNeutralAttrsChange: neutralPatch,
        onDeleteBlock: deleteBlockCallback,
      },
    );

    expect(registeredBinding?.snapshot).toMatchObject({
      places: [{ id: 'place-1', name: 'Seoul', centered: true }],
      textAlignment: 'center',
      previewWidth: 100,
      isResizing: false,
      disabled: false,
    });

    act(() => registeredBinding?.commands.openPlaceManager?.());
    expect(openPlacesModal).toHaveBeenCalledTimes(1);

    act(() => registeredBinding?.commands.focusCaption?.());
    expect(container?.querySelector('input')).toBeTruthy();

    act(() => registeredBinding?.commands.centerPlace?.('place-1'));
    expect(neutralPatch).toHaveBeenLastCalledWith('map-block', expect.objectContaining({ mapPlaceIds: 'place-1' }), {
      centerLat: '37.5',
      centerLng: '127',
    });

    act(() => registeredBinding?.commands.removePlace?.('place-1'));
    expect(neutralPatch).toHaveBeenLastCalledWith(
      'map-block',
      expect.objectContaining({ mapPlaceIds: 'place-1', centerLat: '37.5', centerLng: '127' }),
      { mapPlaceIds: '' },
    );

    act(() => registeredBinding?.commands.changeAlignment?.('right'));
    expect(neutralPatch).toHaveBeenLastCalledWith(
      'map-block',
      expect.objectContaining({ mapPlaceIds: '', centerLat: '37.5', centerLng: '127' }),
      { textAlignment: 'right' },
    );

    act(() => registeredBinding?.commands.deleteBlock?.());
    expect(transactionDelete).toHaveBeenCalledWith(2, 7);
    expect(deleteBlockCallback).toHaveBeenCalledWith(
      'map-block',
      expect.objectContaining({
        mapPlaceIds: '',
        centerLat: '37.5',
        centerLng: '127',
        textAlignment: 'right',
      }),
    );
    expect(editorFocus).toHaveBeenCalledTimes(1);

    act(() => root?.unmount());
    root = null;
    expect(register).toHaveBeenCalled();
    expect(unregisterMenu).toHaveBeenCalledTimes(register.mock.calls.length);
  });

  it('registers a fail-closed menu binding when the editor is read-only', () => {
    const registry: TiptapMapSelectionMenuRegistry = {
      register: vi.fn((_blockId, binding) => {
        registeredBinding = binding;
        return unregisterMenu;
      }),
      get: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    };
    render(
      { mapPlaceIds: 'place-1', previewWidth: '100', aspectRatio: '16:9', caption: 'Seoul' },
      { selectionMenuRegistry: registry, allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true },
      true,
      false,
    );

    expect(registeredBinding?.snapshot.disabled).toBe(true);
    expect(registeredBinding?.commands).toEqual({
      openPlaceManager: undefined,
      removePlace: undefined,
      centerPlace: undefined,
      changeAlignment: undefined,
      focusCaption: undefined,
      deleteBlock: undefined,
    });
  });

  it('hard-gates stale menu command closures after permission revocation', () => {
    const registry: TiptapMapSelectionMenuRegistry = {
      register: vi.fn((_blockId, binding) => {
        registeredBinding = binding;
        return unregisterMenu;
      }),
      get: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    };
    const mounted = render(
      { mapPlaceIds: 'place-1', previewWidth: '100', aspectRatio: '16:9', caption: '' },
      {
        selectionMenuRegistry: registry,
        allowNeutralBlockEdits: true,
        allowLocalizedBlockEdits: true,
        onNeutralAttrsChange: neutralPatch,
        onDeleteBlock: deleteBlockCallback,
      },
    );
    const staleCommands = registeredBinding?.commands;

    mounted.rerender({
      selectionMenuRegistry: registry,
      allowNeutralBlockEdits: false,
      allowLocalizedBlockEdits: false,
      onNeutralAttrsChange: neutralPatch,
      onDeleteBlock: deleteBlockCallback,
    });
    dispatch.mockClear();
    openPlacesModal.mockClear();

    act(() => {
      staleCommands?.openPlaceManager?.();
      staleCommands?.removePlace?.('place-1');
      staleCommands?.centerPlace?.('place-1');
      staleCommands?.changeAlignment?.('right');
      staleCommands?.focusCaption?.();
      staleCommands?.deleteBlock?.();
    });

    expect(registeredBinding?.snapshot.disabled).toBe(true);
    expect(openPlacesModal).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(neutralPatch).not.toHaveBeenCalled();
    expect(deleteBlockCallback).not.toHaveBeenCalled();
    expect(container?.querySelector('input')).toBeNull();
  });
});
