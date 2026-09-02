import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as privacy from './privacy';
import * as terms from './terms';

const mocks = vi.hoisted(() => ({
  createPrivacyClient: vi.fn(),
  createTermsClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

const privacyClient = vi.hoisted(() => ({
  activatePrivacyNow: vi.fn(),
  cancelPrivacySchedule: vi.fn(),
  createPrivacyVersion: vi.fn(),
  deletePrivacy: vi.fn(),
  getPrivacyVersion: vi.fn(),
  regeneratePrivacyDerivedContent: vi.fn(),
  schedulePrivacy: vi.fn(),
}));

const termsClient = vi.hoisted(() => ({
  activateTermsNow: vi.fn(),
  cancelTermsSchedule: vi.fn(),
  createTermsVersion: vi.fn(),
  deleteTerms: vi.fn(),
  getTermsVersion: vi.fn(),
  regenerateTermsDerivedContent: vi.fn(),
  scheduleTerms: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/api/server-client', () => ({
  createPrivacyClient: mocks.createPrivacyClient,
  createTermsClient: mocks.createTermsClient,
}));

describe('privacy and terms actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPrivacyClient.mockResolvedValue(privacyClient);
    mocks.createTermsClient.mockResolvedValue(termsClient);
    privacyClient.createPrivacyVersion.mockResolvedValue({ id: 'privacy-1' });
    termsClient.createTermsVersion.mockResolvedValue({ id: 'terms-1' });
    privacyClient.getPrivacyVersion.mockResolvedValue({ snapshotDigest: 'privacy-digest' });
    termsClient.getTermsVersion.mockResolvedValue({ snapshotDigest: 'terms-digest' });
  });

  it('maps privacy lifecycle actions to the privacy service', async () => {
    const effectiveFrom = new Date('2026-02-03T04:05:06Z');

    await expect(privacy.createPrivacyVersionAction()).resolves.toEqual({
      data: { id: 'privacy-1' },
    });
    await expect(privacy.schedulePrivacyAction('privacy-1', effectiveFrom)).resolves.toEqual({
      success: true,
    });
    await expect(privacy.cancelPrivacyScheduleAction('privacy-1')).resolves.toEqual({
      success: true,
    });
    await expect(privacy.activatePrivacyNowAction('privacy-1')).resolves.toEqual({
      success: true,
    });
    await expect(privacy.regeneratePrivacyHtmlAction('privacy-1')).resolves.toEqual({
      success: true,
    });
    await expect(privacy.deletePrivacyVersionAction('privacy-1')).resolves.toEqual({
      success: true,
    });

    expect(privacyClient.getPrivacyVersion).toHaveBeenCalledWith({ id: 'privacy-1' });
    expect(privacyClient.regeneratePrivacyDerivedContent).toHaveBeenCalledWith({
      id: 'privacy-1',
      expectedSnapshotDigest: 'privacy-digest',
    });
    expect(privacyClient.schedulePrivacy).toHaveBeenCalledWith({
      id: 'privacy-1',
      effectiveFrom: expect.objectContaining({ seconds: BigInt(1770091506) }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/privacy');
  });

  it('maps terms lifecycle actions to the terms service', async () => {
    const effectiveFrom = new Date('2026-03-04T05:06:07Z');

    await expect(terms.createTermsVersionAction()).resolves.toEqual({
      data: { id: 'terms-1' },
    });
    await expect(terms.scheduleTermsAction('terms-1', effectiveFrom)).resolves.toEqual({
      success: true,
    });
    await expect(terms.cancelTermsScheduleAction('terms-1')).resolves.toEqual({
      success: true,
    });
    await expect(terms.activateTermsNowAction('terms-1')).resolves.toEqual({
      success: true,
    });
    await expect(terms.regenerateTermsHtmlAction('terms-1')).resolves.toEqual({
      success: true,
    });
    await expect(terms.deleteTermsVersionAction('terms-1')).resolves.toEqual({
      success: true,
    });

    expect(termsClient.getTermsVersion).toHaveBeenCalledWith({ id: 'terms-1' });
    expect(termsClient.regenerateTermsDerivedContent).toHaveBeenCalledWith({
      id: 'terms-1',
      expectedSnapshotDigest: 'terms-digest',
    });
    expect(termsClient.scheduleTerms).toHaveBeenCalledWith({
      id: 'terms-1',
      effectiveFrom: expect.objectContaining({ seconds: BigInt(1772600767) }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/terms');
  });

  it('returns handled authorization and validation errors', async () => {
    privacyClient.createPrivacyVersion.mockRejectedValueOnce(new ConnectError('session expired', Code.Unauthenticated));
    termsClient.scheduleTerms.mockRejectedValueOnce(new ConnectError('date is required', Code.InvalidArgument));

    await expect(privacy.createPrivacyVersionAction()).resolves.toEqual({
      error: 'Unauthorized',
    });
    await expect(terms.scheduleTermsAction('terms-1', new Date('2026-01-01T00:00:00Z'))).resolves.toEqual({
      error: '[invalid_argument] date is required',
    });
  });

  it('does not regenerate legal projections without an authoritative snapshot digest', async () => {
    privacyClient.getPrivacyVersion.mockResolvedValueOnce({ snapshotDigest: '' });
    termsClient.getTermsVersion.mockResolvedValueOnce({ snapshotDigest: '   ' });

    await expect(privacy.regeneratePrivacyHtmlAction('privacy-1')).resolves.toEqual({
      error: 'Privacy snapshot digest is unavailable',
    });
    await expect(terms.regenerateTermsHtmlAction('terms-1')).resolves.toEqual({
      error: 'Terms snapshot digest is unavailable',
    });
    expect(privacyClient.regeneratePrivacyDerivedContent).not.toHaveBeenCalled();
    expect(termsClient.regenerateTermsDerivedContent).not.toHaveBeenCalled();
  });

  it('does not report committed legal-document deletes as failed when revalidation throws', async () => {
    mocks.revalidatePath
      .mockImplementationOnce(() => {
        throw new Error('cache unavailable');
      })
      .mockImplementationOnce(() => {
        throw new Error('cache unavailable');
      });

    await expect(privacy.deletePrivacyVersionAction('privacy-1')).resolves.toEqual({
      success: true,
    });
    await expect(terms.deleteTermsVersionAction('terms-1')).resolves.toEqual({
      success: true,
    });
    expect(privacyClient.deletePrivacy).toHaveBeenCalledWith({ id: 'privacy-1' });
    expect(termsClient.deleteTerms).toHaveBeenCalledWith({ id: 'terms-1' });
  });
});
