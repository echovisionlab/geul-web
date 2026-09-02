import { resolveP5ParentOrigin, resolveP5RunnerUrl } from '../../../../features/editor/tiptap/p5/p5-runner-url';
import { buildP5RunnerDocument } from './p5-runner-document';

export const dynamic = 'force-dynamic';

export interface P5RunnerDeploymentConfig {
  parentOrigin: string;
  runnerUrl: URL;
}

interface P5RunnerEnvironment {
  SITE_ORIGIN?: string;
  PUBLIC_P5_RUNNER_URL?: string;
}

export function getP5RunnerDeploymentConfig(environment?: P5RunnerEnvironment): P5RunnerDeploymentConfig | null {
  const parentOrigin = resolveP5ParentOrigin(environment?.SITE_ORIGIN ?? process.env.SITE_ORIGIN);
  if (!parentOrigin) {
    return null;
  }
  const runnerUrl = resolveP5RunnerUrl(
    environment?.PUBLIC_P5_RUNNER_URL ?? process.env.PUBLIC_P5_RUNNER_URL,
    parentOrigin,
  );
  return runnerUrl ? { parentOrigin, runnerUrl } : null;
}

export function GET(request: Request): Response {
  const config = getP5RunnerDeploymentConfig();
  const requestHost = (request.headers.get('host') ?? new URL(request.url).host).toLowerCase();
  if (!config || requestHost !== config.runnerUrl.host.toLowerCase()) {
    return new Response(null, { status: 404 });
  }

  const document = buildP5RunnerDocument(config.parentOrigin);
  return new Response(document.html, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': document.contentSecurityPolicy,
      'Content-Type': 'text/html; charset=utf-8',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Permissions-Policy':
        'accelerometer=(self), bluetooth=(self), camera=(self), gamepad=(self), geolocation=(self), gyroscope=(self), microphone=(self), midi=(self), serial=(self)',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
