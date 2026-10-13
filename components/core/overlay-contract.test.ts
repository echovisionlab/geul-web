import { describe, expect, it } from 'vitest';
import { overlayDataAttributes } from './overlay-contract';
describe('closed Core overlay runtime projection', () => {
  it('keeps inert test/content markers and rejects all owned state, geometry and styling paths', () => {
    const unsafe = {
      style: { padding: 1 },
      className: 'local',
      styles: { root: {} },
      vars: {},
      unstyled: true,
      onAction: () => {},
      'data-geul-layout': 'stack',
      'data-core-selected': true,
      'data-size': 'wide',
      'data-position': 'left',
      'data-padding': 'none',
      'data-tone': 'danger',
      'data-selected': true,
      'data-hovered': true,
      'data-entering': true,
      'data-testid': 'menu',
      'data-resource-id': 42,
      'data-preview': true,
    };
    expect(overlayDataAttributes(unsafe)).toEqual({
      'data-testid': 'menu',
      'data-resource-id': 42,
      'data-preview': true,
    });
  });
  it('never forwards data attributes containing functions or objects', () => {
    expect(
      overlayDataAttributes({ 'data-object': {}, 'data-action': () => {}, 'data-null': null, 'data-clear': undefined }),
    ).toEqual({ 'data-clear': undefined });
  });
});
