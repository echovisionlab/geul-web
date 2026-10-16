// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { loadMathRenderer, useRenderedMath } from './math-render-runtime';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ latex, enabled }: { latex: string; enabled: boolean }) {
  const rendered = useRenderedMath(latex, false, enabled);
  return (
    <output data-state={rendered ? 'rendered' : 'pending'} dangerouslySetInnerHTML={{ __html: rendered?.html ?? '' }} />
  );
}

describe('useRenderedMath', () => {
  it('loads KaTeX only when math renders, then renders the formula', async ({ onTestFinished }) => {
    const container = document.createElement('div');
    const root = createRoot(container);
    onTestFinished(async () => {
      await act(async () => root.unmount());
    });
    await act(async () => root.render(<Probe latex="x^2" enabled={false} />));
    expect(container.querySelector('output')?.dataset.state).toBe('pending');

    await act(async () => root.render(<Probe latex="x^2" enabled />));
    await act(async () => {
      await loadMathRenderer();
    });
    expect(container.querySelector('output')?.dataset.state).toBe('rendered');
    expect(container.querySelector('.katex')).not.toBeNull();
  });
});
