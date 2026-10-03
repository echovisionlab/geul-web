import { getSiteOrigin } from '@/lib/env';

export const dynamic = 'force-dynamic';

export function GET() {
  const origin = getSiteOrigin();
  const endpoint = `${origin}/mcp`;
  const guide = `${origin}/guides/remote-mcp.md`;

  return new Response(
    `# Connect Remote MCP

Use this guide to connect an eligible Author or Admin account to this site's Remote MCP.

## Ask an AI agent to install it

Copy this message to Codex or another AI agent that can configure MCP servers:

> Read ${guide} and connect this client to this site's Remote MCP at ${endpoint} exactly as described. Use the server name geul and OAuth browser sign-in. Ask me to complete sign-in and consent when it opens.

## Server details

- Name: \`geul\`
- Type: Streamable HTTP
- URL: \`${endpoint}\`
- Authentication: OAuth 2.1 browser sign-in and consent
- Access: Author and Admin accounts

Personal access tokens are for this site's APIs and are not accepted by Remote MCP.

## Codex CLI

Run:

\`\`\`sh
codex mcp add geul --url ${endpoint}
codex mcp login geul
codex mcp list
\`\`\`

Complete site sign-in and approve the requested MCP access in the browser opened by the login command. In the Codex terminal UI, use \`/mcp\` to check the active server and its tools.

Codex stores MCP server configuration in \`~/.codex/config.toml\` by default. Codex clients on the same host can use that configuration; see the official documentation for your client's controls.

## ChatGPT on the web

If your account has developer mode, enable it under **Settings → Security and login → Developer mode**. Open [ChatGPT Plugins](https://chatgpt.com/plugins), select the plus button, and create a developer-mode app with the URL \`${endpoint}\` and OAuth authentication. Complete site sign-in and consent, then select the app in the conversation's **Developer mode** tools.

ChatGPT web setup is separate from local Codex MCP configuration. Availability and workspace permissions depend on your ChatGPT account.

## Remove or reconnect

In Codex CLI, run \`codex mcp remove geul\` to remove the configuration, or \`codex mcp login geul\` to sign in again.

The site's **Settings → Remote MCP** section lets you revoke a connected client's OAuth access. The **Active sessions** list manages browser sign-in sessions separately.

## Official client documentation

- [OpenAI's Codex MCP documentation](https://developers.openai.com/codex/mcp/)
- [OpenAI's ChatGPT developer mode documentation](https://developers.openai.com/api/docs/guides/developer-mode)
`,
    {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
}
