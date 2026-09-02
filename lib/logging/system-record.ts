import 'server-only';
import { systemLogLevel, validateSystemRecord, type SystemRecord } from '@echovisionlab/geul-telemetry';
import { dispatchLogEntry } from './log-sink';

/** Emits a shared-catalog System record without generic-log field stripping. */
export async function emitSystemRecord(module: string, record: SystemRecord): Promise<void> {
  validateSystemRecord(record);
  await dispatchLogEntry({
    timestamp: record.occurred_at,
    level: systemLogLevel(record),
    module,
    message: record.event,
    attributes: { ...record, module },
  });
}
