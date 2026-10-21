// @vitest-environment jsdom

import { act, type HTMLAttributes } from 'react';
import { render as renderWithProviders, screen } from '@/test/render';
import type { NodeViewProps } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div role="group" aria-label="Map block" {...props}>
      {children}
    </div>
  ),
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
vi.mock('next-intl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl')>()),
  useTranslations: () => (key: string) => key,
}));

vi.mock('@mantine/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mantine/hooks')>()),
  useDisclosure: () => [false, { open: openPlacesModal, close: vi.fn() }],
}));
vi.mock('@/features/place/PlacesManageModal', () => ({ PlacesManageModal: () => null }));
vi.mock('@/features/map/MapLibreMapEditor', () => ({
  MapLibreMapEditor: ({
    config,
    places,
    interactive,
    onConfigChange,
    onManagePlaces,
    settingsPanel,
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
    settingsPanel?: { hidden?: boolean };
  }) => {
    mapEditorSpy.props = { config, interactive };
    return (
      <div
        role="region"
        aria-label="Map canvas"
        data-map-place-count={places.length}
        data-interactive={interactive}
        data-has-place-management={Boolean(onManagePlaces)}
        data-settings-hidden={settingsPanel?.hidden}
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
      role="group"
      aria-label="Map frame"
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

let mounted: ReturnType<typeof renderWithProviders> | undefined;
let user: ReturnType<typeof renderWithProviders>['user'];

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
    const view = <TiptapMapNodeView {...nodeViewProps} {...currentOptions} />;
    if (mounted) {
      mounted.rerender(view);
    } else {
      mounted = renderWithProviders(view);
      user = mounted.user;
    }
  };
  renderCurrent();
  return {
    unmount: () => mounted?.unmount(),
    rerender(nextOptions: TiptapMapNodeOptions, nextEditorEditable = editor.isEditable) {
      editor.isEditable = nextEditorEditable;
      currentOptions = nextOptions;
      renderCurrent();
    },
  };
}

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
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
    render({ mapPlaceIds: 'place-1', displaySize: '100' });

    const mapNode = screen.getByRole('group', { name: 'Map block' });
    const event = new MouseEvent('mousedown', { bubbles: true, button: 0, cancelable: true });
    act(() => mapNode?.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    expect(transactionSetSelection).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(editorFocus).not.toHaveBeenCalled();
  });

  it('renders and updates a full map canvas without requiring a place', async () => {
    render(
      { mapPlaceIds: '', displaySize: '100', centerLat: '37.5', centerLng: '127' },
      { onNeutralAttrsChange: neutralPatch },
    );

    expect(screen.getByRole('region', { name: 'Map canvas' })).toHaveAttribute('data-map-place-count', '0');
    expect(screen.queryByTestId('tiptap-map-empty')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'change map' }));
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
      displaySize: '100',
    });

    expect(screen.getByRole('region', { name: 'Map canvas' })).toHaveAttribute('data-map-place-count', '1');
    expect(mapEditorSpy.props?.config).toEqual(
      expect.objectContaining({
        center: { lat: 37.5, lng: 127 },
      }),
    );
  });

  it('projects stored string flags to the live map config and persists an enabled drag as a string attr', async () => {
    render({
      mapPlaceIds: 'place-1',
      displaySize: '100',
      aspectRatio: '16:9',
      draggable: 'false',
      zoomable: 'false',
      rotatable: 'true',
      tiltable: 'true',
    });

    const map = screen.getByRole('region', { name: 'Map canvas' });
    expect(map?.getAttribute('data-interactive')).toBe('true');
    expect(map?.getAttribute('data-config-draggable')).toBe('false');
    expect(map?.getAttribute('data-config-zoomable')).toBe('false');
    expect(map?.getAttribute('data-config-rotatable')).toBe('true');
    expect(map?.getAttribute('data-config-tiltable')).toBe('true');

    await user.click(screen.getByRole('button', { name: 'enable drag' }));
    expect(updateAttributesSpy).toHaveBeenCalledWith({ draggable: 'true' });
    expect(map?.getAttribute('data-config-draggable')).toBe('true');
    expect(mapEditorSpy.props?.config.draggable).toBe(true);
  });

  it('uses the same durable interaction projection in read-only mode while hard-gating settings writes', async () => {
    render(
      {
        mapPlaceIds: 'place-1',
        displaySize: '100',
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

    const map = screen.getByRole('region', { name: 'Map canvas' });
    expect(map?.getAttribute('data-interactive')).toBe('true');
    expect(map?.getAttribute('data-config-draggable')).toBe('false');
    expect(map?.getAttribute('data-config-zoomable')).toBe('true');
    expect(map?.getAttribute('data-config-rotatable')).toBe('false');
    expect(map?.getAttribute('data-config-tiltable')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'enable drag' }));
    expect(updateAttributesSpy).not.toHaveBeenCalled();
  });

  it('passes Tiptap selection to the resize frame', () => {
    resizeDirection = 'right';
    render({ mapPlaceIds: 'place-1', displaySize: '100', aspectRatio: '16:9', caption: '' }, {}, true);

    expect(screen.getByRole('group', { name: 'Map frame' })).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('group', { name: 'Map frame' })).toHaveAttribute('data-resizing', 'true');
  });

  it('keeps the selected static map surface separate from the text-selectable caption editor', async () => {
    render({ mapPlaceIds: 'place-1', displaySize: '100', aspectRatio: '16:9', caption: '' }, {}, true);

    // eslint-disable-next-line testing-library/no-node-access -- The wrapper owns static text selection; the external map and caption must stay on opposite sides.
    const staticSurface = screen.getByRole('region', { name: 'Map canvas' }).parentElement!;
    const caption = screen.getByRole('button', { name: 'clickToAddCaption' });
    expect(staticSurface).toHaveAttribute('data-map-static-surface');
    expect(caption).toBeTruthy();
    expect(caption?.hasAttribute('data-editor-media-caption')).toBe(false);
    expect(screen.getByRole('group', { name: 'Map frame' })?.getAttribute('data-suppress-static-text-selection')).toBe(
      'true',
    );
    expect(staticSurface).toContainElement(screen.getByText('Map attribution'));
    expect(staticSurface).toContainElement(screen.getByText('Map label'));
    expect(staticSurface).toContainElement(screen.getByRole('button', { name: 'Map settings' }));
    expect(staticSurface?.contains(caption ?? null)).toBe(false);

    await user.click(caption);
    const captionInput = screen.getByRole('textbox', { name: 'captionPlaceholder' });
    expect(captionInput).toBeTruthy();
    expect(staticSurface?.contains(captionInput ?? null)).toBe(false);
  });

  it('hides read-only authoring controls while preserving durable map interactions', async () => {
    render(
      { mapPlaceIds: 'place-1', displaySize: '100', aspectRatio: '16:9', caption: '' },
      {
        allowNeutralBlockEdits: false,
        allowLocalizedBlockEdits: false,
        onNeutralAttrsChange: neutralPatch,
      },
    );

    expect(screen.getByRole('region', { name: 'Map canvas' })).toHaveAttribute('data-interactive', 'true');
    expect(screen.getByRole('region', { name: 'Map canvas' })).toHaveAttribute('data-settings-hidden', 'true');
    expect(screen.getByRole('region', { name: 'Map canvas' })).toHaveAttribute('data-has-place-management', 'false');
    expect(screen.getByRole('group', { name: 'Map frame' })).toHaveAttribute('data-allow-resize', 'false');
    expect(screen.getByRole('button', { name: 'change map' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'change map' }));
    expect(updateAttributesSpy).not.toHaveBeenCalled();
    expect(neutralPatch).not.toHaveBeenCalled();
    expect(screen.queryByText('clickToAddCaption')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clickToAddCaption|Seoul/ })).toBeNull();
  });

  it('keeps the selected read-only display caption inside static selection suppression', () => {
    const mounted = render(
      { mapPlaceIds: 'place-1', displaySize: '100', aspectRatio: '16:9', caption: 'Seoul map' },
      { allowNeutralBlockEdits: false, allowLocalizedBlockEdits: false },
      true,
    );
    mounted.rerender({ allowNeutralBlockEdits: false, allowLocalizedBlockEdits: false }, false);

    const caption = screen.getByText('Seoul map');
    expect(caption).toBeTruthy();
    expect(caption?.tagName).not.toBe('BUTTON');
    expect(caption?.hasAttribute('data-editor-media-caption')).toBe(false);
    expect(screen.getByRole('group', { name: 'Map block' })?.hasAttribute('data-selected')).toBe(false);
    expect(screen.getByRole('group', { name: 'Map frame' })?.hasAttribute('data-selected')).toBe(false);
  });

  it('ANDs localized and neutral permissions with the editor editable state', async () => {
    render(
      { mapPlaceIds: 'place-1', displaySize: '100', aspectRatio: '16:9', caption: 'Seoul' },
      { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true, onNeutralAttrsChange: neutralPatch },
      true,
      false,
    );

    expect(screen.getByRole('region', { name: 'Map canvas' })).toHaveAttribute('data-interactive', 'true');
    expect(screen.getByRole('region', { name: 'Map canvas' })).toHaveAttribute('data-settings-hidden', 'true');
    expect(screen.getByRole('group', { name: 'Map frame' })).toHaveAttribute('data-allow-resize', 'false');
    expect(screen.queryByRole('button', { name: /clickToAddCaption|Seoul/ })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'change map' }));
    expect(updateAttributesSpy).not.toHaveBeenCalled();
    expect(neutralPatch).not.toHaveBeenCalled();
  });

  it('uses a native button to activate localized caption editing', async () => {
    render({ mapPlaceIds: 'place-1', displaySize: '100', aspectRatio: '16:9', caption: '' });

    const caption = screen.getByRole('button', { name: 'clickToAddCaption' });
    expect(caption?.tagName).toBe('BUTTON');
    expect(caption).toHaveAttribute('type', 'button');
    await user.click(caption);
    expect(screen.getByRole('textbox', { name: 'captionPlaceholder' })).toBeInTheDocument();
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
    const view = render(
      {
        mapPlaceIds: 'place-1',
        displaySize: '72',
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
      displaySize: 100,
      isResizing: false,
      disabled: false,
    });

    act(() => registeredBinding?.commands.openPlaceManager?.());
    expect(openPlacesModal).toHaveBeenCalledTimes(1);

    act(() => registeredBinding?.commands.focusCaption?.());
    expect(screen.getByRole('textbox', { name: 'captionPlaceholder' })).toBeInTheDocument();

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

    view.unmount();
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
      { mapPlaceIds: 'place-1', displaySize: '100', aspectRatio: '16:9', caption: 'Seoul' },
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
      { mapPlaceIds: 'place-1', displaySize: '100', aspectRatio: '16:9', caption: '' },
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
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
