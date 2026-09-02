import { describe, expect, it } from 'vitest';
import { serializeAuthTransientPayload } from './SocialAuthButtons';

describe('serializeAuthTransientPayload', () => {
  it('forwards the UI locale through the Kratos social flow', () => {
    expect(JSON.parse(serializeAuthTransientPayload(' pt-BR '))).toEqual({ preferred_locale: 'pt-BR' });
  });
});
