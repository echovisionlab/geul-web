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

## Try it

After connecting, copy a request below and replace the quoted names and text with your own. Reading these examples does not change any content; send an edit request only when you want that change. If a title, name, paragraph, or file matches more than one item, ask the agent to clarify before proceeding.

- **Summarize a Post:**
  > Find the Post titled "Studio notes", read its current body, and summarize it in Korean. If multiple Posts match, ask me which one. Do not edit it.
- **Edit one paragraph:**
  > Find the Post titled "Studio notes" and replace only the paragraph beginning "Opening hours" with "We open at 10 a.m. on weekdays." Keep all other content unchanged. If the Post or paragraph is ambiguous, ask me to choose before editing.
- **Read a Release or Artist:**
  > Find the Release titled "First light" or the Artist named "Echo", ask me which item if there are multiple matches, and read its current document. Summarize what it says without editing it.
- **Replace a file in a Post:**
  > In the Post titled "Studio notes", replace the existing file block for "old-cover.jpg" with the existing file named "new-cover.jpg". Keep all other content unchanged. If the Post, block, or file is ambiguous, ask me to choose before editing. Use an existing file; do not upload a new one.

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
