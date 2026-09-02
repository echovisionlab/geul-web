import { OpenTelemetryTransport } from './transports/opentelemetry';
import type { LogEntry, LogTransport } from './types';

const transports: LogTransport[] = [new OpenTelemetryTransport()];

function writeServerLog(entry: LogEntry): void {
  if (typeof window !== 'undefined' || process.env.NODE_ENV === 'test') {
    return;
  }
  const output = `${JSON.stringify({
    timestamp: entry.timestamp,
    level: entry.level.toUpperCase(),
    message: entry.message,
    ...entry.attributes,
  })}\n`;
  if (entry.level === 'error') {
    process.stderr.write(output);
  } else {
    process.stdout.write(output);
  }
}

export async function dispatchLogEntry(entry: LogEntry): Promise<void> {
  writeServerLog(entry);
  await Promise.allSettled(transports.map((transport) => transport.send(entry)));
}
