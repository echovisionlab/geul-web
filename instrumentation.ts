import { SERVICE_WEB } from '@echovisionlab/geul-telemetry/actor';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: SERVICE_WEB,
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
  });
}
