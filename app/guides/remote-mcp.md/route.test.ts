import { afterEach, describe, expect, it, vi } from 'vitest';

const requestHeaders = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers: requestHeaders }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  requestHeaders.mockReset();
});

describe('Remote MCP installation guide', () => {
  it.each(['https://studio.example.com', 'https://other.example.org', 'http://localhost:3000'])(
    'uses the configured site origin %s for copyable URLs',
    async (origin) => {
      vi.stubEnv('SITE_ORIGIN', `${origin}/`);
      vi.resetModules();
      const { GET } = await import('./route');

      const response = GET();
      const markdown = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(markdown).toContain(`Read ${origin}/guides/remote-mcp.md`);
      expect(markdown).toContain(`codex mcp add geul --url ${origin}/mcp`);
      expect(markdown).toContain('codex mcp login geul');
      expect(markdown).toContain('Author and Admin');
      expect(markdown).not.toContain('dsub.io');
      expect(markdown).not.toMatch(/example\.invalid|SITE_ORIGIN|\$\{/);
    },
  );

  it('serves four copyable task examples between setup and removal', async () => {
    vi.stubEnv('SITE_ORIGIN', 'https://studio.example.com');
    const { GET } = await import('./route');
    const markdown = await GET().text();
    const examples = markdown.split('## Try it\n')[1]?.split('## Remove or reconnect')[0];

    expect(examples).toBeDefined();
    expect(examples?.match(/^ {2}> /gm)).toHaveLength(4);
    expect(markdown.indexOf('## Try it')).toBeGreaterThan(markdown.indexOf('## ChatGPT on the web'));
  });

  it('ignores untrusted request hosts when rendering the endpoint', async () => {
    vi.stubEnv('SITE_ORIGIN', 'https://studio.example.com');
    requestHeaders.mockResolvedValue(
      new Headers({
        host: 'attacker.example',
        'x-forwarded-host': 'attacker.example',
        'x-forwarded-proto': 'http',
      }),
    );
    const { GET } = await import('./route');

    const markdown = await GET().text();

    expect(markdown).toContain('https://studio.example.com/mcp');
    expect(markdown).not.toContain('attacker.example');
    expect(requestHeaders).not.toHaveBeenCalled();
  });
});
