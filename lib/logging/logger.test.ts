import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ emit: vi.fn(), traceCorrelation: vi.fn(() => ({})) }));

vi.mock('@echovisionlab/geul-telemetry/trace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@echovisionlab/geul-telemetry/trace')>();
  return { ...actual, traceCorrelationFromActiveContext: mocks.traceCorrelation };
});

vi.mock('@opentelemetry/api-logs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@opentelemetry/api-logs')>();
  return {
    ...actual,
    logs: { getLogger: () => ({ emit: mocks.emit, enabled: () => true }) },
  };
});

describe('createLogger', () => {
  afterEach(() => {
    mocks.emit.mockReset();
    mocks.traceCorrelation.mockReset();
    mocks.traceCorrelation.mockReturnValue({});
    vi.unstubAllEnvs();
  });

  it('can be imported and used without the full app environment schema', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { createLogger } = await import('./logger');
    await expect(createLogger('logger-test').info('ready')).resolves.toBeUndefined();
  });

  it('emits normalized OTLP attributes and drops sensitive values', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { createLogger } = await import('./logger');
    await createLogger('logger-test').error('failed to write', {
      data: {
        operation: 'cache_write',
        jobId: 'job-1',
        nickname: 'private-name',
        displayName: 'private display',
        tokenPrefix: 'secret',
        objectKey: 'private/key',
        sourcePath: '/private/source',
        recipient: 'person@example.com',
        nested: { leaked: 'value' },
      },
      error: new Error('person@example.com was rejected'),
    });

    expect(mocks.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        severityText: 'ERROR',
        body: 'failed to write',
        attributes: expect.objectContaining({
          module: 'logger-test',
          operation: 'cache_write',
          job_id: 'job-1',
          error_type: 'error',
        }),
      }),
    );
    const record = mocks.emit.mock.calls[0]?.[0];
    expect(record).not.toHaveProperty('eventName');
    expect(record.attributes).not.toHaveProperty('event');
    expect(record.attributes).not.toHaveProperty('outcome');
    expect(record.attributes).not.toHaveProperty('nickname');
    expect(record.attributes).not.toHaveProperty('display_name');
    expect(record.attributes).not.toHaveProperty('token_prefix');
    expect(record.attributes).not.toHaveProperty('object_key');
    expect(record.attributes).not.toHaveProperty('source_path');
    expect(record.attributes).not.toHaveProperty('recipient');
    expect(record.attributes).not.toHaveProperty('nested');
    expect(JSON.stringify(record)).not.toContain('person@example.com');
  });

  it('adds the active canonical trace correlation', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { createLogger } = await import('./logger');
    const spanContext = {
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
    };
    mocks.traceCorrelation.mockReturnValue({ trace_id: spanContext.traceId, span_id: spanContext.spanId });

    await createLogger('logger-test').info('request handled');

    expect(mocks.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({ trace_id: spanContext.traceId, span_id: spanContext.spanId }),
      }),
    );
  });

  it('emits a validated shared System record without generic-log field stripping', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { buildClientRenderFailedRecord } = await import('@echovisionlab/geul-telemetry');
    const { emitSystemRecord } = await import('./system-record');
    const record = buildClientRenderFailedRecord({ occurred_at: '2026-08-13T10:00:00.000Z' }, 'general');

    await emitSystemRecord('client-render-failure-intake', record);

    expect(mocks.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        severityText: 'ERROR',
        body: 'client.render.failed',
        attributes: expect.objectContaining({
          module: 'client-render-failure-intake',
          event: 'client.render.failed',
          outcome: 'failed',
          domain: 'client',
          component: 'general',
          reason: 'react_error_boundary',
        }),
      }),
    );
  });
});
