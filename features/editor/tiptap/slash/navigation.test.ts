import { describe, expect, it } from 'vitest';
import { reduceTiptapSlashNavigation } from './navigation';

describe('Tiptap slash keyboard navigation', () => {
  it('wraps ArrowDown and ArrowUp while focus stays in the editor', () => {
    expect(reduceTiptapSlashNavigation({ key: 'ArrowDown', activeIndex: 2, itemCount: 3 })).toEqual({
      command: 'move',
      activeIndex: 0,
      preventDefault: true,
    });
    expect(reduceTiptapSlashNavigation({ key: 'ArrowUp', activeIndex: 0, itemCount: 3 })).toEqual({
      command: 'move',
      activeIndex: 2,
      preventDefault: true,
    });
  });

  it('supports old PageUp/PageDown plus Home/End, Enter, Tab, and Escape', () => {
    expect(reduceTiptapSlashNavigation({ key: 'Home', activeIndex: 2, itemCount: 4 })).toMatchObject({
      command: 'move',
      activeIndex: 0,
    });
    expect(reduceTiptapSlashNavigation({ key: 'End', activeIndex: 0, itemCount: 4 })).toMatchObject({
      command: 'move',
      activeIndex: 3,
    });
    expect(reduceTiptapSlashNavigation({ key: 'PageUp', activeIndex: 2, itemCount: 4 })).toMatchObject({
      command: 'move',
      activeIndex: 0,
    });
    expect(reduceTiptapSlashNavigation({ key: 'PageDown', activeIndex: 0, itemCount: 4 })).toMatchObject({
      command: 'move',
      activeIndex: 3,
    });
    expect(reduceTiptapSlashNavigation({ key: 'Enter', activeIndex: 2, itemCount: 4 })).toMatchObject({
      command: 'activate',
      activeIndex: 2,
      preventDefault: true,
    });
    expect(reduceTiptapSlashNavigation({ key: 'Tab', activeIndex: 1, itemCount: 4 })).toMatchObject({
      command: 'activate',
      activeIndex: 1,
      preventDefault: true,
    });
    expect(reduceTiptapSlashNavigation({ key: 'Escape', activeIndex: 1, itemCount: 4 })).toMatchObject({
      command: 'dismiss',
      preventDefault: true,
    });
  });

  it('never intercepts navigation or activation during IME composition', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', 'Tab', 'Escape']) {
      expect(reduceTiptapSlashNavigation({ key, activeIndex: 1, itemCount: 3, isComposing: true })).toEqual({
        command: 'none',
        activeIndex: 1,
        preventDefault: false,
      });
      expect(reduceTiptapSlashNavigation({ key, activeIndex: 1, itemCount: 3, editorIsComposing: true })).toEqual({
        command: 'none',
        activeIndex: 1,
        preventDefault: false,
      });
    }
  });

  it('dismisses an empty result menu but leaves unrelated empty-menu keys alone', () => {
    expect(reduceTiptapSlashNavigation({ key: 'Escape', activeIndex: 0, itemCount: 0 })).toMatchObject({
      command: 'dismiss',
      preventDefault: true,
    });
    expect(reduceTiptapSlashNavigation({ key: 'Enter', activeIndex: 0, itemCount: 0 })).toEqual({
      command: 'none',
      activeIndex: 0,
      preventDefault: false,
    });
  });
});
