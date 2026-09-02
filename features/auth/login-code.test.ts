import { describe, expect, it } from 'vitest';
import type { KratosBrowserFlow } from './kratos-flow';
import { buildLoginCodePayload } from './login-code';

const awaitingCodeFlow: KratosBrowserFlow = {
  id: 'flow-1',
  ui: {
    nodes: [
      {
        type: 'input',
        group: 'default',
        attributes: {
          name: 'identifier',
          value: 'johndoe@example.com',
        },
      },
    ],
  },
};

describe('buildLoginCodePayload', () => {
  it('keeps the authoritative flow identifier when completing a login code', () => {
    expect(
      buildLoginCodePayload({
        flow: awaitingCodeFlow,
        enteredEmail: '',
        code: '123456',
      }),
    ).toEqual({
      method: 'code',
      identifier: 'johndoe@example.com',
      code: '123456',
    });
  });

  it('uses the trimmed entered email for the first code request', () => {
    expect(
      buildLoginCodePayload({
        flow: { ...awaitingCodeFlow, ui: { nodes: [] } },
        enteredEmail: '  john@example.com  ',
      }),
    ).toEqual({
      method: 'code',
      identifier: 'john@example.com',
    });
  });

  it('carries the UI locale as provider transient metadata', () => {
    expect(
      buildLoginCodePayload({
        flow: awaitingCodeFlow,
        enteredEmail: '',
        locale: 'pt-BR',
      }),
    ).toEqual({
      method: 'code',
      identifier: 'johndoe@example.com',
      transient_payload: { preferred_locale: 'pt-BR' },
    });
  });
});
