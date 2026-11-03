// @vitest-environment jsdom

import { act, render, screen, waitFor } from '@/test/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { DEFAULT_MAP_CONFIG } from '@/lib/types/map/model';
import { MapLibreMapEditor } from './MapLibreMapEditor';

const mocks = vi.hoisted(() => ({
  mapProps: null as Record<string, unknown> | null,
  pendingChunk: false,
}));

vi.mock('next/dynamic', () => ({
  default: (_load: unknown, options: { loading: () => React.ReactNode }) => (props: Record<string, unknown>) => {
    if (mocks.pendingChunk) {
      return options.loading();
    }
    mocks.mapProps = props;
    return <div data-testid="map" />;
  },
}));

const theme = {
  themeId: 'theme-1',
  scheme: 'light' as const,
  settings: DEFAULT_THEME_SETTINGS,
  variant: { ...DEFAULT_LIGHT_VARIANT, id: 'light' },
};
const resolveTheme = vi.fn<NonNullable<React.ComponentProps<typeof MapLibreMapEditor>['resolveTheme']>>();
let client: QueryClient;
let view: ReturnType<typeof render> | undefined;
beforeEach(() => {
  mocks.mapProps = null;
  mocks.pendingChunk = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  resolveTheme.mockReset().mockResolvedValue(theme);
});
afterEach(() => {
  view?.unmount();
  view = undefined;
  client.clear();
});
function renderEditor(props: Partial<React.ComponentProps<typeof MapLibreMapEditor>> = {}) {
  const element = (
    <QueryClientProvider client={client}>
      <MapLibreMapEditor
        config={DEFAULT_MAP_CONFIG}
        onConfigChange={vi.fn()}
        places={[]}
        settingsPanel={{ collapsed: false }}
        resolveTheme={resolveTheme}
        {...props}
      />
    </QueryClientProvider>
  );
  if (view) {
    view.rerender(element);
  } else {
    view = render(element);
  }
}

describe('MapLibreMapEditor interactions', () => {
  it.each([
    {
      name: 'uses each enabled stored setting when the editor is interactive',
      interactive: true,
      config: {
        draggable: true,
        zoomable: false,
        rotatable: true,
        tiltable: false,
        pinClickable: true,
      },
      expected: {
        draggable: true,
        zoomable: false,
        rotatable: true,
        tiltable: false,
        pinClickable: true,
      },
    },
    {
      name: 'uses each disabled stored setting when the editor is interactive',
      interactive: true,
      config: {
        draggable: false,
        zoomable: true,
        rotatable: false,
        tiltable: true,
        pinClickable: false,
      },
      expected: {
        draggable: false,
        zoomable: true,
        rotatable: false,
        tiltable: true,
        pinClickable: false,
      },
    },
    {
      name: 'disables camera gestures but preserves configured pin clicks when editing is disabled',
      interactive: false,
      config: {
        draggable: true,
        zoomable: true,
        rotatable: true,
        tiltable: true,
        pinClickable: true,
      },
      expected: {
        draggable: false,
        zoomable: false,
        rotatable: false,
        tiltable: false,
        pinClickable: true,
      },
    },
    {
      name: 'preserves disabled pin clicks when editing is disabled',
      interactive: false,
      config: {
        draggable: true,
        zoomable: true,
        rotatable: true,
        tiltable: true,
        pinClickable: false,
      },
      expected: {
        draggable: false,
        zoomable: false,
        rotatable: false,
        tiltable: false,
        pinClickable: false,
      },
    },
  ])('$name', async ({ config, expected, interactive }) => {
    renderEditor({ config: { ...DEFAULT_MAP_CONFIG, ...config }, interactive });

    await waitFor(() => expect(mocks.mapProps).toEqual(expect.objectContaining(expected)));
  });
});

describe('MapLibreMapEditor parameter copy localization', () => {
  it('names each parameter copy action with the copy message for that parameter', async () => {
    renderEditor();
    await view!.user.click(await screen.findByRole('button', { name: 'Camera' }));
    expect(screen.getByRole('button', { name: 'Click to copy Zoom value' })).toBeInTheDocument();
  });
});

it.each(['theme', 'chunk'])('renders the shared loader during %s preparation', async (phase) => {
  const pending = Promise.withResolvers<typeof theme>();
  resolveTheme.mockReturnValueOnce(pending.promise);
  mocks.pendingChunk = phase === 'chunk';
  renderEditor();
  expect(screen.getByRole('status')).toHaveTextContent('Unfolding the atlas...');
  await act(async () => pending.resolve(theme));
  if (phase === 'chunk') {
    expect(screen.getByRole('status')).toHaveTextContent('Unfolding the atlas...');
    mocks.pendingChunk = false;
    renderEditor();
  }
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
});
it('does not leave a theme failure waiting', async () => {
  resolveTheme.mockRejectedValueOnce(new Error('Theme unavailable'));
  renderEditor();
  expect(await screen.findByRole('alert')).toHaveTextContent('The map theme could not be loaded.');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
