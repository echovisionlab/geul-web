import { PassThrough } from 'node:stream';
import type { ComponentType } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BlockViewProps } from './types';
import { FormView } from './form/View';
import { MapView } from './map/View';
import { ImmersiveSceneView } from './immersive-scene/View';

const probes = vi.hoisted(() => ({
  loaded: { form: 0, map: 0, scene: 0 },
  options: [] as Array<{ ssr?: boolean } | undefined>,
  received: new Map<string, unknown>(),
}));

// Next compiles next/dynamic to this App Router implementation. Exercise its
// real lazy/SSR behavior, rather than a mock that synchronously imports leaves.
vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  return {
    default: (...args: Parameters<typeof dynamic>) => {
      probes.options.push(args[1]);
      return dynamic(...args);
    },
  };
});

vi.mock('./form/ViewRuntime', () => {
  probes.loaded.form += 1;
  return {
    FormView: (props: BlockViewProps & { preview?: boolean }) => {
      probes.received.set('form', props);
      return <form data-public-form="">Form content</form>;
    },
  };
});
vi.mock('./map/ViewRuntime', () => {
  probes.loaded.map += 1;
  return {
    MapView: (props: BlockViewProps) => {
      probes.received.set('map', props);
      return <div data-public-map="">Map caption</div>;
    },
  };
});
vi.mock('./immersive-scene/ViewRuntime', () => {
  probes.loaded.scene += 1;
  return {
    ImmersiveSceneView: (props: BlockViewProps) => {
      probes.received.set('scene', props);
      return <div data-immersive-scene="">Scene copy</div>;
    },
  };
});

function renderServer(View: ComponentType<BlockViewProps & { preview?: boolean }>, props: BlockViewProps) {
  return new Promise<string>((resolve, reject) => {
    const output = new PassThrough();
    let html = '';
    output.on('data', (chunk) => {
      html += chunk.toString();
    });
    output.on('end', () => resolve(html));
    output.on('error', reject);
    const stream = renderToPipeableStream(<View {...props} />, {
      onAllReady() {
        stream.pipe(output);
      },
      onError: reject,
    });
  });
}

describe('public block runtime boundaries', () => {
  it('loads only rendered leaves, retains server HTML, and forwards the entire public/preview contract', async () => {
    expect(probes.loaded).toEqual({ form: 0, map: 0, scene: 0 });
    expect(probes.options).toHaveLength(3);
    expect(probes.options.every((options) => options?.ssr !== false)).toBe(true);
    const props = {
      sectionId: 'section-1',
      props: { selectedId: 'resource-1' },
      requestedLocale: 'ko',
      query: { page: '2' },
      content: [],
      columns: [],
      preview: true,
    };
    expect(await renderServer(FormView, props)).toContain('data-public-form=""');
    expect(probes.loaded).toEqual({ form: 1, map: 0, scene: 0 });
    expect(probes.received.get('form')).toEqual(props);
    expect(await renderServer(MapView, props)).toContain('Map caption');
    expect(probes.loaded).toEqual({ form: 1, map: 1, scene: 0 });
    expect(probes.received.get('map')).toEqual(props);
    expect(await renderServer(ImmersiveSceneView, props)).toContain('Scene copy');
    expect(probes.loaded).toEqual({ form: 1, map: 1, scene: 1 });
    expect(probes.received.get('scene')).toEqual(props);
  });
});
