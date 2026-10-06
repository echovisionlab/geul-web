// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ToolModule } from './ToolModule';
import { loadToolModule, type MountedTool, type ToolModule as Module } from './loadToolModule';
vi.mock('./loadToolModule', () => ({ loadToolModule: vi.fn() }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
const uri = 'https://tools-anything.dsub.io/embed/index.js';
function render(options: { uri?: string; locale?: string; colorScheme?: 'light' | 'dark'; preview?: boolean } = {}) {
  act(() =>
    root.render(
      <MantineProvider>
        <ToolModule
          uri={options.uri ?? uri}
          locale={options.locale ?? 'en'}
          colorScheme={options.colorScheme ?? 'light'}
          preview={options.preview ?? false}
          activateLabel="activate"
          loadingLabel="loading"
          errorLabel="error"
        />
      </MantineProvider>,
    ),
  );
}
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}
function instance(): MountedTool {
  return { update: vi.fn(), destroy: vi.fn() };
}
beforeEach(() => {
  vi.mocked(loadToolModule).mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
describe('tool module lifecycle', () => {
  it('keeps previews inert until activated and updates context without remounting', async () => {
    const tool = instance();
    const mount = vi.fn(async (host: HTMLElement) => {
      host.attachShadow({ mode: 'open' }).innerHTML = '<button>Tool content</button>';
      return tool;
    });
    vi.mocked(loadToolModule).mockResolvedValue({ mount });
    render({ preview: true });
    expect(loadToolModule).not.toHaveBeenCalled();
    act(() => container.querySelector('button')!.click());
    await settle();
    expect(mount).toHaveBeenCalledTimes(1);
    expect(container.querySelector('iframe')).toBeNull();
    render({ preview: true, locale: 'ko', colorScheme: 'dark' });
    expect(mount).toHaveBeenCalledTimes(1);
    expect(tool.update).toHaveBeenLastCalledWith({ locale: 'ko', colorScheme: 'dark' });
  });
  it('aborts, destroys and removes dirty owned hosts on URI replacement without affecting another block', async () => {
    const first = instance();
    const second = instance();
    const hosts: HTMLElement[] = [];
    const signals: AbortSignal[] = [];
    const mount: Module['mount'] = vi.fn(async (host, options) => {
      hosts.push(host);
      signals.push(options.signal!);
      host.dataset.dirty = 'yes';
      host.setAttribute('style', 'height: 9000px');
      return hosts.length === 1 ? first : second;
    });
    vi.mocked(loadToolModule).mockResolvedValue({ mount });
    render();
    await settle();
    render({ uri: 'https://tools-new.dsub.io/embed/index.js' });
    await settle();
    expect(signals[0].aborted).toBe(true);
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(hosts[0].isConnected).toBe(false);
    expect(hosts[1]).not.toBe(hosts[0]);
    act(() => root.unmount());
    root = createRoot(container);
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(hosts[1].isConnected).toBe(false);
  });
  it('destroys a mount that resolves after cancellation and never installs its handle', async () => {
    let resolve!: (tool: MountedTool) => void;
    let signal: AbortSignal | undefined;
    const promise = new Promise<MountedTool>((done) => {
      resolve = done;
    });
    vi.mocked(loadToolModule).mockResolvedValue({
      mount: vi.fn((_host, options) => {
        signal = options.signal;
        return promise;
      }),
    });
    render();
    await settle();
    act(() => root.unmount());
    root = createRoot(container);
    expect(signal?.aborted).toBe(true);
    const late = instance();
    await act(async () => resolve(late));
    expect(late.destroy).toHaveBeenCalledTimes(1);
    expect(late.update).not.toHaveBeenCalled();
    expect(container.childElementCount).toBe(0);
  });
  it('does not mount after a canceled import and exposes loading/import failures without partial DOM', async () => {
    let resolve!: (module: Module) => void;
    vi.mocked(loadToolModule).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render();
    expect(container.querySelector('[role="status"]')?.textContent).toBe('loading');
    const mount = vi.fn();
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => resolve({ mount }));
    expect(mount).not.toHaveBeenCalled();
    vi.mocked(loadToolModule).mockRejectedValueOnce(new Error('network'));
    render();
    await settle();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('error');
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
  it('removes partially mounted content on failure and uses the latest context after an async mount', async () => {
    vi.mocked(loadToolModule).mockResolvedValueOnce({
      mount: vi.fn(async (host) => {
        host.dataset.dirty = 'yes';
        host.append(document.createElement('input'));
        throw new Error('mount failed');
      }),
    });
    render();
    await settle();
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('[data-dirty]')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('error');
    let resolve!: (tool: MountedTool) => void;
    vi.mocked(loadToolModule).mockResolvedValueOnce({
      mount: vi.fn(
        () =>
          new Promise<MountedTool>((done) => {
            resolve = done;
          }),
      ),
    });
    render({ uri: `${uri}?replacement` });
    await settle();
    render({ uri: `${uri}?replacement`, locale: 'ko', colorScheme: 'dark' });
    const tool = instance();
    await act(async () => resolve(tool));
    expect(tool.update).toHaveBeenLastCalledWith({ locale: 'ko', colorScheme: 'dark' });
  });
  it('keeps simultaneous module instances independent', async () => {
    const instances: MountedTool[] = [];
    vi.mocked(loadToolModule).mockResolvedValue({
      mount: vi.fn(async () => {
        const tool = instance();
        instances.push(tool);
        return tool;
      }),
    });
    act(() =>
      root.render(
        <MantineProvider>
          {['a', 'b'].map((id) => (
            <ToolModule
              key={id}
              uri={`${uri}?id=${id}`}
              locale="en"
              colorScheme="light"
              preview={false}
              activateLabel="activate"
              loadingLabel="loading"
              errorLabel="error"
            />
          ))}
        </MantineProvider>,
      ),
    );
    await settle();
    expect(instances).toHaveLength(2);
    act(() =>
      root.render(
        <MantineProvider>
          {['b'].map((id) => (
            <ToolModule
              key={id}
              uri={`${uri}?id=${id}`}
              locale="en"
              colorScheme="light"
              preview={false}
              activateLabel="activate"
              loadingLabel="loading"
              errorLabel="error"
            />
          ))}
        </MantineProvider>,
      ),
    );
    expect(instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(instances[1].destroy).not.toHaveBeenCalled();
  });
});
