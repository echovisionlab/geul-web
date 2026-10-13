import { describe, expect, it } from 'vitest';
import { verticalKeyboardCoordinates } from './verticalKeyboardCoordinates';

function rect(top: number, height: number) {
  return { top, bottom: top + height, left: 0, right: 280, width: 280, height };
}

describe('verticalKeyboardCoordinates', () => {
  it.each([
    { key: 'ArrowDown', active: rect(0, 440), target: rect(440, 42), y: 241 },
    { key: 'ArrowUp', active: rect(440, 42), target: rect(0, 440), y: 199 },
  ])('centers differently sized items when moving $key', ({ key, active, target, y }) => {
    const data = { current: { type: 'item' } };
    const container = { id: 'next', data, disabled: false };
    const context = {
      active: { id: 'active', data },
      collisionRect: active,
      droppableContainers: { getEnabled: () => [container] },
      droppableRects: new Map([['next', target]]),
    } as unknown as Parameters<typeof verticalKeyboardCoordinates>[1]['context'];
    const event = { code: key, preventDefault: () => undefined } as KeyboardEvent;
    expect(
      verticalKeyboardCoordinates(event, {
        active: 'active',
        context,
        currentCoordinates: { x: 0, y: active.top },
      }),
    ).toEqual({ x: 0, y });
  });
});
