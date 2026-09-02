import { SERVICE_WEB } from '@echovisionlab/geul-telemetry/actor';
import { traceCorrelationFromActiveContext } from '@echovisionlab/geul-telemetry/trace';
import { context } from '@opentelemetry/api';
import { logs, SeverityNumber, type AnyValueMap } from '@opentelemetry/api-logs';
import type { LogEntry, LogTransport } from '../types';

const otelLogger = logs.getLogger(SERVICE_WEB);

const severityNumbers = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
} as const;

export class OpenTelemetryTransport implements LogTransport {
  name = 'opentelemetry';

  async send(entry: LogEntry): Promise<void> {
    // Browser records are intentionally not exported directly. A public browser
    // must never receive the collector endpoint or become an untrusted log source.
    if (typeof window !== 'undefined') {
      return;
    }

    const attributes: Record<string, unknown> = {
      module: entry.module,
      ...entry.attributes,
      ...traceCorrelationFromActiveContext(),
    };

    otelLogger.emit({
      timestamp: new Date(entry.timestamp),
      severityNumber: severityNumbers[entry.level],
      severityText: entry.level.toUpperCase(),
      body: entry.message,
      attributes: attributes as AnyValueMap,
      context: context.active(),
    });
  }
}
