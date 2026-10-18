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
    engine.initialize.mockImplementation((config) => events.push(`${config.theme}:${config.themeVariables.darkMode}`));
    engine.render.mockImplementation(async (_id, source) => {
      events.push(source);
      await Promise.resolve();
      events.push('done');
      return { svg: '<svg viewBox="0 0 180 90"/>' };
    });
    const signal = new AbortController().signal;
    const images = await Promise.all([renderMermaid('A', 'dark', signal), renderMermaid('B', 'light', signal)]);
    expect(events).toEqual(['base:true', 'A', 'done', 'base:false', 'B', 'done']);
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

  it('projects authored SVG accessibility metadata through the image-document boundary without altering source', async () => {
    const { renderMermaid } = await import('./mermaid-renderer');
    const svg =
      '<svg viewBox="0 0 240 100" aria-labelledby="diagram-title" aria-describedby="diagram-description"><title id="diagram-title">Draft &amp; review</title><desc id="diagram-description">Approved drafts publish.\nRejected drafts return.</desc><g><title>Node hint</title></g></svg>';
    engine.render.mockResolvedValue({ svg });
    const source =
      'flowchart LR\n accTitle: Draft & review\n accDescr {\n Approved drafts publish.\n Rejected drafts return.\n }\n A --> B';
    await expect(renderMermaid(source, 'light', new AbortController().signal)).resolves.toEqual({
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      width: 240,
      accessibleTitle: 'Draft & review',
      accessibleDescription: 'Approved drafts publish.\nRejected drafts return.',
    });
    expect(engine.render.mock.calls[0][1]).toBe(source);
  });

  it('reads direct SVG title/description fallback but does not invent metadata from node hints', async () => {
    const { renderMermaid } = await import('./mermaid-renderer');
    engine.render.mockResolvedValueOnce({
      svg: '<svg><title>Review workflow</title><desc>Draft enters review.</desc></svg>',
    });
    await expect(renderMermaid('first', 'light', new AbortController().signal)).resolves.toMatchObject({
      accessibleTitle: 'Review workflow',
      accessibleDescription: 'Draft enters review.',
    });
    engine.render.mockResolvedValueOnce({ svg: '<svg><g><title>Only a node hint</title></g></svg>' });
    const image = await renderMermaid('second', 'light', new AbortController().signal);
    expect(image).not.toHaveProperty('accessibleTitle');
    expect(image).not.toHaveProperty('accessibleDescription');
  });
});

describe('Mermaid site-owned theme defaults', () => {
  it('preserves explicit authored diagram styles and locks only global presentation configuration', async () => {
    const { renderMermaid } = await import('./mermaid-renderer');
    const source = 'flowchart LR\n A --> B\n classDef authored fill:#336699,color:#fff\n class A authored';
    await renderMermaid(source, 'light', new AbortController().signal);
    expect(engine.render.mock.calls[0][1]).toBe(source);
    expect(engine.initialize.mock.calls[0][0].secure).toEqual(
      expect.arrayContaining(['theme', 'themeVariables', 'themeCSS']),
    );
  });
});
