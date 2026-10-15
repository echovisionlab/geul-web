// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { IconButton } from '@/components/core/IconButton';
import { TestProviders } from '@/test/TestProviders';
import { ParticipantRow } from './ParticipantRow';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it('keeps repeated role commands connected to existing identity and role text', () => {
  act(() =>
    root.render(
      <TestProviders>
        <ParticipantRow
          memberId="one"
          nickname="Mina"
          roleLabel="Author"
          identityId="participant-one"
          principal
          actions={
            <IconButton aria-label="Remove" aria-describedby="participant-one">
              ×
            </IconButton>
          }
        />
        <ParticipantRow
          memberId="two"
          nickname="June"
          roleLabel="Collaborator"
          identityId="participant-two"
          inactiveLabel="Inactive authority"
          actions={
            <IconButton aria-label="Remove" aria-describedby="participant-two">
              ×
            </IconButton>
          }
        />
      </TestProviders>,
    ),
  );
  const rows = Array.from(container.querySelectorAll('[data-participant-id]'));
  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.getAttribute('role'))).toEqual(['group', 'group']);
  expect(
    rows.map((row) =>
      row
        .getAttribute('aria-labelledby')
        ?.split(' ')
        .map((id) => document.getElementById(id)?.textContent),
    ),
  ).toEqual([
    ['Mina', 'Author'],
    ['June', 'Collaborator'],
  ]);
  const buttons = Array.from(container.querySelectorAll('button[aria-label="Remove"]'));
  expect(
    buttons.map((button) => document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent),
  ).toEqual(['Mina', 'June']);
  expect(container.querySelector('[role="img"][aria-label="Inactive authority"]')).not.toBeNull();
});
