import { SERVICE_WEB } from '@echovisionlab/geul-telemetry/actor';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { registerOTel } from '@vercel/otel';
import { logServerFailure } from '@/lib/logging/logger';

export function register() {
  registerOTel({
    serviceName: SERVICE_WEB,
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
  });
}

// Record the original server error before Next serializes it for a client
// error boundary. Use the route template, never request headers or URLs.
export function onRequestError(error: unknown, _request: unknown, context: { routeType: string; routePath: string }) {
  logServerFailure('next-request', `${context.routeType} ${context.routePath}`, error);
}
