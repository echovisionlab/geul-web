// @vitest-environment jsdom

import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { ExecutableBlockTitle, ExecutableRuntimeControls, ExecutableRuntimeStatus } from './ExecutableRuntimeControls';

describe('ExecutableRuntimeControls', () => {
  it('announces supplied starting, running and stopped labels through one polite live region without a message provider', () => {
    expect(
      renderToStaticMarkup(
        <ExecutableRuntimeStatus status="starting" starting="준비 중" running="Running" stopped="Stopped" />,
      ),
    ).toContain('준비 중');
    const politeRegion = (text: string) =>
      screen.getByText((_, element) => element?.getAttribute('aria-live') === 'polite' && element.textContent === text);
    const { rerender } = render(
      <ExecutableRuntimeStatus status="running" running="Running" stopped="Stopped" starting="준비 중" />,
    );

    const status = politeRegion('Running');

    rerender(<ExecutableRuntimeStatus status="starting" running="Running" stopped="Stopped" starting="준비 중" />);
    expect(politeRegion('준비 중')).toBe(status);
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
    rerender(<ExecutableRuntimeStatus status="stopped" running="Running" stopped="Stopped" starting="준비 중" />);

    expect(politeRegion('Stopped')).toBe(status);
  });

  it('can clear and replace an authored title without persisting fallback copy', async () => {
    function Titles() {
      const [title, setTitle] = useState('Original scene');
      return (
        <>
          <ExecutableBlockTitle title={title} fallback="Three.js scene" editable onChange={setTitle} />
          <ExecutableBlockTitle title={title} fallback="Three.js scene" editable={false} />
        </>
      );
    }
    const { user } = render(<Titles />);
    const input = screen.getByRole('textbox', { name: 'Three.js scene' });
    for (const title of ['', '밤하늘 Scene', '']) {
      await user.clear(input);
      if (title) {
        await user.type(input, title);
      }
      expect(input).toHaveValue(title);
      expect(screen.getByText(title || 'Three.js scene')).toBeInTheDocument();
    }
  });

  it('keeps stop, restart and original reset in one transparent icon-control row', async () => {
    const callbacks = { stop: vi.fn(), restart: vi.fn(), reset: vi.fn() };
    const { user } = render(
      <ExecutableRuntimeControls
        type="p5Sketch"
        running
        labels={{ run: 'Run', stop: 'Stop', restart: 'Restart', resetOriginal: 'Reset to original' }}
        onRun={callbacks.restart}
        onStop={callbacks.stop}
        onRestart={callbacks.restart}
        onResetOriginal={callbacks.reset}
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Stop',
      'Restart',
      'Reset to original',
    ]);
    for (const button of buttons) {
      expect(button).toHaveAttribute('data-emphasis', 'low');
      await user.click(button);
    }
    expect(callbacks.stop).toHaveBeenCalledOnce();
    expect(callbacks.restart).toHaveBeenCalledOnce();
    expect(callbacks.reset).toHaveBeenCalledOnce();
  });
});
