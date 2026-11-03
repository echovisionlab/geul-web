// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@/test/render';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolModule } from './ToolModule';
import { loadToolModule, type MountedTool, type ToolModule as Module } from './loadToolModule';
vi.mock('./loadToolModule', () => ({ loadToolModule: vi.fn() }));
const uri = 'https://portadj.dsub.io/embed/index.js';
function toolNode(options: { uri?: string; locale?: string; colorScheme?: 'light' | 'dark'; preview?: boolean } = {}) {
  return (
    <ToolModule
      uri={options.uri ?? uri}
      locale={options.locale ?? 'en'}
      colorScheme={options.colorScheme ?? 'light'}
      preview={options.preview ?? false}
      activateLabel="activate"
      loadingLabel="loading"
      errorLabel="error"
      title="Tool"
    />
  );
}
function instance(): MountedTool {
  return { update: vi.fn(), destroy: vi.fn() };
}
beforeEach(() => {
  vi.mocked(loadToolModule).mockReset();
});

describe('tool module lifecycle', () => {
  it('keeps previews inert until activated and updates context without remounting', async () => {
    const tool = instance();
    const mount = vi.fn(async (host: HTMLElement) => {
      host.textContent = 'Tool content';
      return tool;
    });
    vi.mocked(loadToolModule).mockResolvedValue({ mount });
    const { user, rerender } = render(toolNode({ preview: true }));
    expect(loadToolModule).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'activate' }));
    expect(await screen.findByText('Tool content')).toBeVisible();
    expect(mount).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('group', { name: 'Tool' }).innerHTML).not.toMatch(/<iframe\b/);
    rerender(toolNode({ preview: true, locale: 'ko', colorScheme: 'dark' }));
    expect(mount).toHaveBeenCalledTimes(1);
    expect(tool.update).toHaveBeenLastCalledWith({ locale: 'ko', colorScheme: 'dark' });
  });

  it('aborts and removes dirty owned hosts on URI replacement and unmount', async () => {
    const first = instance();
    const second = instance();
    const hosts: HTMLElement[] = [];
    const signals: AbortSignal[] = [];
    const mount: Module['mount'] = vi.fn(async (host, options) => {
      hosts.push(host);
      signals.push(options.signal!);
      host.dataset.dirty = 'yes';
      host.style.height = '9000px';
      host.textContent = `Instance ${hosts.length}`;
      return hosts.length === 1 ? first : second;
    });
    vi.mocked(loadToolModule).mockResolvedValue({ mount });
    const { rerender, unmount } = render(toolNode());
    expect(await screen.findByText('Instance 1')).toBeVisible();
    rerender(toolNode({ uri: 'https://hwp.dsub.io/embed/index.js' }));
    expect(await screen.findByText('Instance 2')).toBeVisible();
    expect(signals[0]!.aborted).toBe(true);
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(hosts[0]!.isConnected).toBe(false);
    expect(hosts[1]).not.toBe(hosts[0]);
    unmount();
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(hosts[1]!.isConnected).toBe(false);
  });

  it('destroys a mount that resolves after cancellation and never installs its handle', async () => {
    let finish!: (tool: MountedTool) => void;
    let signal: AbortSignal | undefined;
    const pending = new Promise<MountedTool>((resolve) => {
      finish = resolve;
    });
    const mount = vi.fn((_host: HTMLElement, options: { signal?: AbortSignal }) => {
      signal = options.signal;
      return pending;
    });
    vi.mocked(loadToolModule).mockResolvedValue({ mount });
    const { unmount, container } = render(toolNode());
    await waitFor(() => expect(mount).toHaveBeenCalledOnce());
    expect(screen.getByRole('status', { name: 'Loading...' })).toHaveTextContent('loading');
    unmount();
    expect(signal?.aborted).toBe(true);
    const late = instance();
    await act(async () => finish(late));
    expect(late.destroy).toHaveBeenCalledTimes(1);
    expect(late.update).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('does not mount after a canceled import and distinguishes loading from import failure', async () => {
    let finish!: (module: Module) => void;
    vi.mocked(loadToolModule).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { unmount } = render(toolNode());
    expect(screen.getByRole('status', { name: 'Loading...' })).toHaveTextContent('loading');
    const mount = vi.fn();
    unmount();
    await act(async () => finish({ mount }));
    expect(mount).not.toHaveBeenCalled();
    vi.mocked(loadToolModule).mockRejectedValueOnce(new Error('network'));
    render(toolNode());
    expect(await screen.findByRole('alert')).toHaveTextContent('error');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('removes partial content on failure and delivers the latest context after an asynchronous mount', async () => {
    let failedHost: HTMLElement | undefined;
    vi.mocked(loadToolModule).mockResolvedValueOnce({
      mount: vi.fn(async (host) => {
        failedHost = host;
        host.dataset.dirty = 'yes';
        host.append(document.createElement('input'));
        throw new Error('mount failed');
      }),
    });
    const { rerender } = render(toolNode());
    expect(await screen.findByRole('alert')).toHaveTextContent('error');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(failedHost?.isConnected).toBe(false);
    let finish!: (tool: MountedTool) => void;
    const mount = vi.fn(
      () =>
        new Promise<MountedTool>((resolve) => {
          finish = resolve;
        }),
    );
    vi.mocked(loadToolModule).mockResolvedValueOnce({ mount });
    rerender(toolNode({ uri: `${uri}?replacement` }));
    await waitFor(() => expect(mount).toHaveBeenCalledOnce());
    rerender(toolNode({ uri: `${uri}?replacement`, locale: 'ko', colorScheme: 'dark' }));
    const tool = instance();
    await act(async () => finish(tool));
    expect(tool.update).toHaveBeenLastCalledWith({ locale: 'ko', colorScheme: 'dark' });
  });

  it('keeps simultaneous module instances independent', async () => {
    const instances: MountedTool[] = [];
    vi.mocked(loadToolModule).mockResolvedValue({
      mount: vi.fn(async (host) => {
        const tool = instance();
        instances.push(tool);
        host.textContent = `Instance ${instances.length}`;
        return tool;
      }),
    });
    const nodes = (ids: string[]) =>
      ids.map((id) => (
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
      ));
    const { rerender } = render(<>{nodes(['a', 'b'])}</>);
    expect(await screen.findByText('Instance 2')).toBeVisible();
    expect(instances).toHaveLength(2);
    rerender(<>{nodes(['b'])}</>);
    expect(instances[0]!.destroy).toHaveBeenCalledTimes(1);
    expect(instances[1]!.destroy).not.toHaveBeenCalled();
  });
});
