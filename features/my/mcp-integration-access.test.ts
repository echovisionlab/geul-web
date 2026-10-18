import { describe, expect, it } from 'vitest';
import { canAccessMcpIntegrationSettings } from './mcp-integration-access';

describe('MCP integration discovery access', () => {
  it.each([
    ['user', false],
    ['author', true],
    ['admin', true],
    [undefined, false],
  ] as const)('maps role %s to OAuth MCP discovery access=%s', (role, expected) => {
    expect(canAccessMcpIntegrationSettings(role)).toBe(expected);
  });
});
