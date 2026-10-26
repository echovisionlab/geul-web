// @vitest-environment jsdom
import { render, screen } from '@/test/render';
import { expect, it } from 'vitest';
import { applyVideoMediaPresentation } from './native-video';

it('applies the shared large icon control to the SDK start button without a vjs-button class', () => {
  render(
    <div className="video-js" role="group" aria-label="Video preview">
      <button type="button" className="vjs-big-play-button" aria-label="Start video" />
    </div>,
  );
  const dispose = applyVideoMediaPresentation(screen.getByRole('group', { name: 'Video preview' }), {
    kind: 'video-js',
  });
  try {
    const start = screen.getByRole('button', { name: 'Start video' });
    expect(start).toHaveAttribute('data-control-kind', 'icon');
    expect(start).toHaveAttribute('data-control-size', 'lg');
    expect(start).toHaveAttribute('data-contrast', 'inverse');
  } finally {
    dispose();
  }
});
