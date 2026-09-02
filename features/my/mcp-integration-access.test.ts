import { describe, expect, it } from 'vitest';
import { canAccessMcpIntegrationSettings, projectPersonalAccessTokensForSettings } from './mcp-integration-access';

describe('MCP integration discovery access', () => {
  it.each([
    ['user', false],
    ['author', true],
    ['admin', true],
    [undefined, false],
  ] as const)('maps role %s to OAuth MCP discovery access=%s', (role, expected) => {
    expect(canAccessMcpIntegrationSettings(role)).toBe(expected);
  });

  it('projects the generic API token without introducing MCP metadata', () => {
    const projected = projectPersonalAccessTokensForSettings([{ id: 'pat-1', createdAt: '2026-08-23T00:00:00.000Z' }]);

    expect(projected).toEqual([{ id: 'pat-1', createdAt: '2026-08-23T00:00:00.000Z', canRegenerate: true }]);
    expect(JSON.stringify(projected)).not.toMatch(/mcp/i);
  });
});
