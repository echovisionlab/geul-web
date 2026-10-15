// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useTranslationActionFocus } from './useTranslationActionFocus';

type Phase = 'idle' | 'request-pending' | 'queued' | 'cancel-pending';
let transition: (phase: Phase) => void;
function Harness() {
  const [phase, setPhase] = useState<Phase>('idle');
  transition = setPhase;
  const { commandRef, rememberCommand } = useTranslationActionFocus();
  return (
    <>
      <button
        type="button"
        ref={commandRef('generate')}
        disabled={phase !== 'idle'}
        onClick={(event) => {
          rememberCommand(event.currentTarget, 'generate', 'cancel');
          setPhase('request-pending');
        }}
      >
        Generate
      </button>
      {phase === 'queued' || phase === 'cancel-pending' ? (
        <button
          type="button"
          ref={commandRef('cancel')}
          disabled={phase === 'cancel-pending'}
          onClick={(event) => {
            rememberCommand(event.currentTarget, 'generate', 'cancel');
            setPhase('cancel-pending');
          }}
        >
          Cancel
        </button>
      ) : null}
      <button type="button">Elsewhere</button>
    </>
  );
}

let host: HTMLDivElement;
let root: Root;
function button(label: string) {
  const node = Array.from(host.querySelectorAll('button')).find((item) => item.textContent === label);
  if (!node) {
    throw new Error(`Missing ${label}`);
  }
  return node;
}
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function request() {
  act(() => {
    button('Generate').focus();
    button('Generate').click();
  });
}

it('moves a focused request to its queued cancel command and back after completion', () => {
  request();
  expect(button('Generate').disabled).toBe(true);
  act(() => transition('queued'));
  expect(document.activeElement).toBe(button('Cancel'));
  act(() => transition('idle'));
  expect(document.activeElement).toBe(button('Generate'));
});

it('returns a focused cancellation to the enabled request after its command disappears', () => {
  request();
  act(() => transition('queued'));
  act(() => button('Cancel').click());
  expect(button('Cancel').disabled).toBe(true);
  act(() => transition('idle'));
  expect(document.activeElement).toBe(button('Generate'));
});

it('leaves deliberate navigation elsewhere intact during background completion', () => {
  request();
  act(() => transition('queued'));
  act(() => button('Elsewhere').focus());
  act(() => transition('idle'));
  expect(document.activeElement).toBe(button('Elsewhere'));
});

it('returns a failed request to its existing enabled trigger', () => {
  request();
  act(() => transition('idle'));
  expect(document.activeElement).toBe(button('Generate'));
});

it('does not focus commands requested programmatically while the user is elsewhere', () => {
  act(() => {
    button('Elsewhere').focus();
    button('Generate').click();
  });
  act(() => transition('queued'));
  expect(document.activeElement).toBe(button('Elsewhere'));
});
