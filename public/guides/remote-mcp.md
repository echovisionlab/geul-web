# Connect Remote MCP

Use this guide to connect an eligible Author or Admin account to a compatible AI client.

Replace `https://site.example.invalid` below with the deployed `SITE_ORIGIN` for
your site. The public endpoint is `${SITE_ORIGIN}/mcp`.

## Ask an AI agent to install it

Send this message to Codex or another AI agent that can configure MCP servers:

> Read `${SITE_ORIGIN}/guides/remote-mcp.md` and connect this client to this site's Remote MCP exactly as described. Do not use a personal access token. Ask me to complete browser sign-in and consent when it opens.

## Server details

- Name: `site`
- Type: Streamable HTTP
- URL: `https://site.example.invalid/mcp`
- Authentication: OAuth 2.1 browser sign-in and consent
- Access: Author and Admin accounts

Personal access tokens are for this site's APIs and are not accepted by Remote MCP.

## ChatGPT desktop app

1. Open **Settings** and select **MCP servers**.
2. Select **Add server**.
3. Enter `site` as the name, choose **Streamable HTTP**, and enter `https://site.example.invalid/mcp`.
4. Save and restart the app.
5. Select **Authenticate**, then finish site sign-in and consent in the browser.
6. Type `/mcp` in the composer to confirm that your site is connected.

## Codex CLI

Run:

```sh
codex mcp add site --url https://site.example.invalid/mcp
codex mcp login site
codex mcp list
```

The login command opens a browser. Sign in to your site and approve the requested MCP access.

The ChatGPT desktop app, Codex CLI, and Codex IDE extension share MCP configuration on the same Codex host.

## Codex IDE extension

Open the gear menu, select **MCP servers**, and add the same `site` Streamable HTTP URL. Restart the extension and select **Authenticate**.

## ChatGPT on the web

ChatGPT web does not read local Codex MCP configuration. It uses remote MCP tools supplied through installed plugins. Use the ChatGPT desktop app or a local Codex client for this direct server connection unless your site provides a ChatGPT plugin.

## Remove or reconnect

Use the MCP server settings in the ChatGPT desktop app or IDE extension. In Codex CLI, run `codex mcp --help` to see the current remove and login commands.

The **Active sessions** list manages browser sign-in sessions. MCP OAuth grants appear separately under **Settings → Remote MCP**, where you can revoke each connected client without signing out of your browser sessions.

## Official client documentation

See [OpenAI's MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) for current client-specific controls.
