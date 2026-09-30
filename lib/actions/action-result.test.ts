import { describe, expect, it } from 'vitest';
import { actionFailure, actionSuccess, type ActionResult } from './action-result';

describe('ActionResult', () => {
  it('keeps success data and failure details exclusive', () => {
    const success: ActionResult<{ data: { id: string } }, { reason: 'blocked' }> = actionSuccess({
      data: { id: 'item-1' },
    });
    const failure: ActionResult<{ data: { id: string } }, { reason: 'blocked' }> = actionFailure(
      'Not allowed',
      'POST_CREATE_FAILED',
      { reason: 'blocked' },
    );

    expect(success).toEqual({ ok: true, data: { id: 'item-1' } });
    expect(failure).toEqual({
      ok: false,
      error: 'Not allowed',
      errorCode: 'POST_CREATE_FAILED',
      reason: 'blocked',
    });

    const acceptResult = (_value: ActionResult<{ data: string }>) => undefined;
    // @ts-expect-error success and failure fields cannot coexist
    acceptResult({ ok: true, data: 'saved', error: 'failed too', errorCode: 'ITEM_FAILED' });
    // @ts-expect-error a failure cannot carry success-only data
    acceptResult({ ok: false, error: 'failed', errorCode: 'ITEM_FAILED', data: 'saved' });
    // @ts-expect-error helper fields cannot override the discriminator
    const attemptedSuccessOverride = actionSuccess({ ok: false });
    expect(attemptedSuccessOverride).toEqual({ ok: true });
    // @ts-expect-error helper fields cannot override the failure envelope
    const attemptedFailureOverride = actionFailure('failed', 'ITEM_FAILED', { error: 'replaced' });
    expect(attemptedFailureOverride).toEqual({ ok: false, error: 'failed', errorCode: 'ITEM_FAILED' });
  });

  it('keeps failure messages non-empty', () => {
    expect(actionFailure('   ', 'POST_CREATE_FAILED')).toEqual({
      ok: false,
      error: 'Action failed',
      errorCode: 'POST_CREATE_FAILED',
    });
  });
});
