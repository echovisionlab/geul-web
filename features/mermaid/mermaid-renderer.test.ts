// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const engine = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock('mermaid', () => ({ default: engine }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  engine.render.mockResolvedValue({ svg: '<svg><text>A & B</text></svg>' });
});

describe('Mermaid rendering boundary', () => {
  it('serializes configuration and rendering across themes and returns an image document', async () => {
    const { renderMermaid } = await import('./mermaid-renderer');
    const events: string[] = [];
    engine.initialize.mockImplementation((config) => events.push(config.theme));
    engine.render.mockImplementation(async (_id, source) => {
      events.push(source);
      await Promise.resolve();
      events.push('done');
      return { svg: '<svg viewBox="0 0 180 90"/>' };
    });
    const signal = new AbortController().signal;
    const images = await Promise.all([renderMermaid('A', 'dark', signal), renderMermaid('B', 'light', signal)]);
    expect(events).toEqual(['dark', 'A', 'done', 'default', 'B', 'done']);
    expect(images).toEqual(
      Array(2).fill({
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg viewBox="0 0 180 90"/>')}`,
        width: 180,
      }),
    );
    expect(engine.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: 'strict', startOnLoad: false }),
    );
  });

  it('continues rendering after invalid input fails', async () => {
    const { renderMermaid } = await import('./mermaid-renderer');
    engine.render.mockRejectedValueOnce(new Error('syntax'));
    const signal = new AbortController().signal;
    await expect(renderMermaid('invalid', 'light', signal)).rejects.toThrow('syntax');
    await expect(renderMermaid('valid', 'light', signal)).resolves.toMatchObject({
      src: expect.stringContaining('data:image/svg+xml'),
    });
  });

  it('skips cancelled and oversized sources before invoking the renderer', async () => {
    const { renderMermaid, MERMAID_SOURCE_LIMIT } = await import('./mermaid-renderer');
    const controller = new AbortController();
    controller.abort();
    await expect(renderMermaid('A', 'light', controller.signal)).rejects.toThrow();
    await expect(
      renderMermaid('A'.repeat(MERMAID_SOURCE_LIMIT + 1), 'light', new AbortController().signal),
    ).rejects.toThrow('too long');
    expect(engine.render).not.toHaveBeenCalled();
  });
});
