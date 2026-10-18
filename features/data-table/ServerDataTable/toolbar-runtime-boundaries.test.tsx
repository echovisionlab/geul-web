import { PassThrough } from 'node:stream';
import type { ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ServerDataTableMultiFilter, type ServerDataTableMultiFilterProps } from './ServerDataTableMultiFilter';
import { ServerDataTableMultiSort, type ServerDataTableMultiSortProps } from './ServerDataTableMultiSort';
import { ServerDataTableSearch, type ServerDataTableSearchProps } from './ServerDataTableSearch';

const probes = vi.hoisted(() => ({
  loaded: { filter: 0, sort: 0, search: 0 },
  options: [] as Array<{ ssr?: boolean } | undefined>,
  received: new Map<string, unknown>(),
}));

// Use Next's actual App Router lazy implementation and streaming server renderer.
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

vi.mock('./ServerDataTableMultiFilterRuntime', () => {
  probes.loaded.filter += 1;
  return {
    ServerDataTableMultiFilter: (props: ServerDataTableMultiFilterProps) => {
      probes.received.set('filter', props);
      return <button type="button">Filter toolbar</button>;
    },
  };
});
vi.mock('./ServerDataTableMultiSortRuntime', () => {
  probes.loaded.sort += 1;
  return {
    ServerDataTableMultiSort: (props: ServerDataTableMultiSortProps) => {
      probes.received.set('sort', props);
      return <button type="button">Sort toolbar</button>;
    },
  };
});
vi.mock('./ServerDataTableSearchRuntime', () => {
  probes.loaded.search += 1;
  return {
    ServerDataTableSearch: (props: ServerDataTableSearchProps) => {
      probes.received.set('search', props);
      return <input aria-label={props.placeholder} />;
    },
  };
});

function renderServer(element: ReactNode) {
  return new Promise<string>((resolve, reject) => {
    const output = new PassThrough();
    let html = '';
    output.on('data', (chunk) => {
      html += chunk.toString();
    });
    output.on('end', () => resolve(html));
    output.on('error', reject);
    const stream = renderToPipeableStream(element, {
      onAllReady() {
        stream.pipe(output);
      },
      onError: reject,
    });
  });
}

describe('ServerDataTable optional toolbar runtime boundaries', () => {
  it('loads only rendered toolbars, preserves server HTML, and forwards every prop', async () => {
    expect(probes.loaded).toEqual({ filter: 0, sort: 0, search: 0 });
    expect(probes.options).toHaveLength(3);
    expect(probes.options.every((options) => options?.ssr !== false)).toBe(true);
    const filterProps: ServerDataTableMultiFilterProps = {
      namespace: 'artists',
      fields: [{ field: 'name', label: 'Name', type: 'string' }],
      placeholder: 'Filter',
      allowLogicToggle: false,
    };
    expect(await renderServer(<ServerDataTableMultiFilter {...filterProps} />)).toContain('Filter toolbar');
    expect(probes.loaded).toEqual({ filter: 1, sort: 0, search: 0 });
    expect(probes.received.get('filter')).toEqual(filterProps);
    const sortProps: ServerDataTableMultiSortProps = {
      namespace: 'posts',
      fields: [{ field: 'title', label: 'Title' }],
      placeholder: 'Sort',
      maxSorts: 5,
    };
    expect(await renderServer(<ServerDataTableMultiSort {...sortProps} />)).toContain('Sort toolbar');
    expect(probes.loaded).toEqual({ filter: 1, sort: 1, search: 0 });
    expect(probes.received.get('sort')).toEqual(sortProps);
    const searchProps: ServerDataTableSearchProps = {
      namespace: 'works',
      placeholder: 'Search works',
      debounceMs: 450,
    };
    expect(await renderServer(<ServerDataTableSearch {...searchProps} />)).toContain('aria-label="Search works"');
    expect(probes.loaded).toEqual({ filter: 1, sort: 1, search: 1 });
    expect(probes.received.get('search')).toEqual(searchProps);
  });
});
