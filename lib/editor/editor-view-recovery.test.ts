// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { captureEditorViewRecovery } from './editor-view-recovery';
afterEach(() => document.body.replaceChildren());
it('restores the selection and scroll into a replacement editable without stealing other focus', () => {
  document.body.innerHTML =
    '<div id="scroll"><div contenteditable="true" tabindex="0">hello world</div></div><button>Elsewhere</button>';
  const original = document.querySelector<HTMLElement>('[contenteditable]')!;
  original.focus();
  document.getSelection()?.setBaseAndExtent(original.firstChild!, 2, original.firstChild!, 7);
  const scroll = document.getElementById('scroll')!;
  scroll.scrollTop = 240;
  const restore = captureEditorViewRecovery();
  expect(restore).not.toBeNull();
  original.outerHTML = '<div contenteditable="true" tabindex="0">hello world!</div>';
  scroll.scrollTop = 0;
  restore?.();
  expect(document.getSelection()?.toString()).toBe('llo w');
  expect(scroll.scrollTop).toBe(240);
  document.querySelector('button')!.focus();
  restore?.();
  expect(document.activeElement).toBe(document.querySelector('button'));
});
