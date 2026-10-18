// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { avatarInitial } from './avatar-initial';
import { Avatar, type AvatarProps } from './Display';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('avatarInitial', () => {
  it.each([
    ['june han', 'J'],
    ['  émile', 'É'],
    ['한글 사용자', '한'],
    ['@writer', 'W'],
    ['(주)회사', '주'],
    ['👩🏽‍💻', '👩🏽‍💻'],
    ['éclair', 'É'],
    ['ßtraße', 'ß'],
    ['istanbul', 'I'],
  ])('derives %j → %j', (name, initial) => {
    expect(avatarInitial(name)).toBe(initial);
  });

  it.each([undefined, null, '', '   '])('returns null for blank %j', (name) => {
    expect(avatarInitial(name)).toBeNull();
  });
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
function render(props: AvatarProps) {
  act(() => root.render(<Avatar {...props} />));
  return container.firstElementChild as HTMLElement;
}

describe('Avatar name fallback', () => {
  it('renders a decorative uppercase initial when no image renders', () => {
    const avatar = render({ name: 'june' });
    expect(avatar).toHaveTextContent('J');
    expect(avatar.querySelector('[data-avatar-initial]')).toHaveAttribute('aria-hidden', 'true');
    expect(avatar).not.toHaveAttribute('role');
  });

  it('uses the shared person glyph for blank names and keeps alt as the only name', () => {
    expect(render({ name: null }).querySelector('svg')).not.toBeNull();
    const named = render({ name: 'June', alt: 'June Han' });
    expect(named).toHaveAttribute('role', 'img');
    expect(named).toHaveAccessibleName('June Han');
  });

  it('prefers the image and falls back to the initial when it fails', () => {
    const avatar = render({ name: 'june', src: '/broken.png' });
    expect(avatar.querySelector('img')).not.toBeNull();
    act(() => avatar.querySelector('img')!.dispatchEvent(new Event('error')));
    expect(avatar).toHaveTextContent('J');
  });
});
