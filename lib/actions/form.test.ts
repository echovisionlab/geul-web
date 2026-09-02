import { revalidatePath } from 'next/cache';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import {
  FormAccessContext,
  FormAccessReason,
  FormAccessTarget,
  FormStatus,
} from '@echovisionlab/geul-proto/public/form_pb.ts';
import { FormStatus as ManageFormStatus } from '@echovisionlab/geul-proto/secure/form_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import { createFormClient, createPublicFormClientWithAuth } from '@/lib/api/server-client';
import {
  checkFormAccessAction,
  checkFormAccessibilityBySlugAction,
  createFormAction,
  deleteFormAction,
  deleteFormSubmissionAction,
  getFormDashboardByShareAction,
  getFormSubmissionStatsAction,
  listFormsAdminAction,
  listFormSubmissionsAction,
  regenerateFormOgImageAction,
  removeFormFeaturedImageAction,
  setFormFeaturedImageAction,
  submitFormAction,
  updateFormAction,
  verifyFormPasswordAction,
} from './form';

const checkAccessMock = vi.fn();
const createFormRpcMock = vi.fn();
const listFormsAdminMock = vi.fn();
const deleteFormRpcMock = vi.fn();
const updateFormRpcMock = vi.fn();
const setFeaturedImageMock = vi.fn();
const deleteFeaturedImageMock = vi.fn();
const listSubmissionsMock = vi.fn();
const deleteSubmissionMock = vi.fn();
const getSubmissionStatsMock = vi.fn();
const getDashboardMock = vi.fn();
const submitMock = vi.fn();
const verifyPasswordMock = vi.fn();
const regenerateOgImageMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/actions/share-link', () => ({
  createShareLinkAction: vi.fn(),
  deleteShareLinkAction: vi.fn(),
  listShareLinksAction: vi.fn(),
}));

vi.mock('@/lib/actions/og-generation', () => ({
  regenerateOgImageAction: (...args: unknown[]) => regenerateOgImageMock(...args),
}));

vi.mock('@/lib/api/server-client', () => ({
  createFormClient: vi.fn(),
  createPublicFormClientWithAuth: vi.fn(async () => ({
    checkAccess: checkAccessMock,
    getDashboard: getDashboardMock,
    submit: submitMock,
    verifyPassword: verifyPasswordMock,
  })),
}));

function createManageFormClientMock() {
  return {
    createForm: createFormRpcMock,
    deleteForm: deleteFormRpcMock,
    deleteFormFeaturedImage: deleteFeaturedImageMock,
    deleteFormSubmission: deleteSubmissionMock,
    getFormSubmissionStats: getSubmissionStatsMock,
    listFormSubmissions: listSubmissionsMock,
    listFormsAdmin: listFormsAdminMock,
    setFormFeaturedImage: setFeaturedImageMock,
    updateForm: updateFormRpcMock,
  } as unknown as Awaited<ReturnType<typeof createFormClient>>;
}

beforeEach(() => {
  checkAccessMock.mockReset();
  createFormRpcMock.mockReset();
  deleteFeaturedImageMock.mockReset();
  deleteFormRpcMock.mockReset();
  deleteSubmissionMock.mockReset();
  getDashboardMock.mockReset();
  getSubmissionStatsMock.mockReset();
  listFormsAdminMock.mockReset();
  listSubmissionsMock.mockReset();
  setFeaturedImageMock.mockReset();
  submitMock.mockReset();
  updateFormRpcMock.mockReset();
  verifyPasswordMock.mockReset();
  regenerateOgImageMock.mockReset();
  vi.mocked(createFormClient).mockReset();
  regenerateOgImageMock.mockResolvedValue({
    runId: 'form-run',
    generationIds: ['form-generation'],
  });
  vi.mocked(createFormClient).mockResolvedValue(createManageFormClientMock());
  vi.mocked(createPublicFormClientWithAuth).mockClear();
  vi.mocked(revalidatePath).mockClear();
});

describe('checkFormAccessAction', () => {
  it('returns localized public form data for accessible responses', async () => {
    checkAccessMock.mockResolvedValue({
      accessible: true,
      reason: FormAccessReason.UNSPECIFIED,
      form: {
        id: 'form-1',
        title: '문의하기',
        slug: 'contact',
        schema: new TextEncoder().encode(JSON.stringify({ id: 'schema-1', steps: [] })),
        status: FormStatus.PUBLISHED,
        isPublic: true,
        requireAuth: false,
        allowedRoles: ['user'],
        allowDuplicateSubmission: true,
        hasPassword: false,
        maxSubmissions: 50,
        opensAt: undefined,
        closesAt: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      },
    });

    await expect(
      checkFormAccessAction({
        slug: 'contact',
        context: 'embed',
        requestedLocale: 'ko',
      }),
    ).resolves.toEqual({
      accessible: true,
      form: {
        id: 'form-1',
        title: '문의하기',
        slug: 'contact',
        schema: { id: 'schema-1', steps: [] },
        status: 'published',
        isPublic: true,
        requireAuth: false,
        allowedRoles: ['user'],
        allowDuplicateSubmission: true,
        hasPassword: false,
        maxSubmissions: 50,
        opensAt: undefined,
        closesAt: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      },
    });

    expect(checkAccessMock).toHaveBeenCalledWith({
      slug: 'contact',
      shareToken: undefined,
      sharePassword: undefined,
      password: undefined,
      context: FormAccessContext.EMBED,
      target: FormAccessTarget.FORM,
    });
  });

  it('does not parse metadata-only denied responses as full form schema', async () => {
    checkAccessMock.mockResolvedValue({
      accessible: false,
      reason: FormAccessReason.PASSWORD_REQUIRED,
      form: {
        id: 'form-1',
        name: 'Protected Form',
        slug: 'protected-form',
        schema: new Uint8Array(),
        status: FormStatus.PUBLISHED,
        isPublic: true,
        requireAuth: false,
        allowedRoles: [],
        allowDuplicateSubmission: true,
        hasPassword: true,
        maxSubmissions: undefined,
        opensAt: undefined,
        closesAt: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      },
    });

    await expect(
      checkFormAccessAction({
        slug: 'protected-form',
        context: 'url',
        requestedLocale: 'ko',
      }),
    ).resolves.toEqual({
      accessible: false,
      reason: 'password_required',
      requiresPassword: true,
      form: null,
    });

    expect(createPublicFormClientWithAuth).toHaveBeenCalledWith('ko');
  });

  it('maps already submitted access denials', async () => {
    checkAccessMock.mockResolvedValue({
      accessible: false,
      reason: FormAccessReason.ALREADY_SUBMITTED,
      form: {
        id: 'form-1',
        name: 'Protected Form',
        slug: 'protected-form',
        schema: new Uint8Array(),
        status: FormStatus.PUBLISHED,
        isPublic: true,
        requireAuth: true,
        allowedRoles: [],
        allowDuplicateSubmission: false,
        hasPassword: false,
        maxSubmissions: undefined,
        opensAt: undefined,
        closesAt: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      },
    });

    await expect(
      checkFormAccessAction({
        slug: 'protected-form',
        context: 'url',
      }),
    ).resolves.toEqual({
      accessible: false,
      reason: 'already_submitted',
      requiresPassword: false,
      form: null,
    });
  });

  it('maps ConnectError access failures to the correct public reasons', async () => {
    checkAccessMock.mockRejectedValueOnce(new ConnectError('missing', Code.NotFound));
    await expect(checkFormAccessAction({ slug: 'contact', context: 'url' })).resolves.toEqual({
      accessible: false,
      reason: 'form_not_found',
      form: null,
    });

    checkAccessMock.mockRejectedValueOnce(new ConnectError('auth', Code.Unauthenticated));
    await expect(checkFormAccessAction({ slug: 'contact', context: 'url' })).resolves.toEqual({
      accessible: false,
      reason: 'auth_required',
      form: null,
    });

    checkAccessMock.mockRejectedValueOnce(new ConnectError('forbidden', Code.PermissionDenied));
    await expect(checkFormAccessAction({ slug: 'contact', context: 'url' })).resolves.toEqual({
      accessible: false,
      reason: 'role_not_allowed',
      form: null,
    });
  });

  it('falls back to server_error for unmapped access rpc failures', async () => {
    checkAccessMock.mockRejectedValueOnce(new ConnectError('boom', Code.Internal));

    await expect(checkFormAccessAction({ slug: 'contact', context: 'url' })).resolves.toEqual({
      accessible: false,
      reason: 'server_error',
      form: null,
    });
  });

  it('wraps share-link accessibility checks with url context and trimmed tokens', async () => {
    checkAccessMock.mockResolvedValue({
      accessible: false,
      reason: FormAccessReason.PASSWORD_REQUIRED,
      form: undefined,
    });

    await expect(checkFormAccessibilityBySlugAction('contact', ' share-token ', 'ko')).resolves.toEqual({
      accessible: false,
      reason: 'password_required',
      requiresPassword: true,
      form: null,
    });

    expect(createPublicFormClientWithAuth).toHaveBeenCalledWith('ko');
    expect(checkAccessMock).toHaveBeenCalledWith({
      slug: 'contact',
      shareToken: ' share-token ',
      sharePassword: undefined,
      password: undefined,
      context: FormAccessContext.URL,
      target: FormAccessTarget.FORM,
    });
  });

  it('creates forms with public URL access disabled by default', async () => {
    createFormRpcMock.mockResolvedValue({ id: 'form-1' });

    await expect(createFormAction('Fresh Form')).resolves.toEqual({
      data: { id: 'form-1' },
    });

    expect(createFormRpcMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Fresh Form',
        isPublic: false,
      }),
    );
  });

  it('requests localized dashboard data with the caller locale and maps field stats', async () => {
    getDashboardMock.mockResolvedValue({
      dashboard: {
        formId: 'form-1',
        formTitle: '문의 폼',
        formSlug: 'contact',
        totalSubmissions: 42,
        submissionsToday: 5,
        submissionsThisWeek: 12,
        submissionsThisMonth: 23,
        fieldStats: [
          {
            fieldId: 'field-type',
            fieldLabel: '유형',
            values: [
              { value: 'artwork', count: 8 },
              { value: 'recording', count: 3 },
            ],
          },
        ],
      },
    });

    await expect(
      getFormDashboardByShareAction({
        slug: 'contact',
        shareToken: ' share-token ',
        requestedLocale: 'ko',
      }),
    ).resolves.toEqual({
      formId: 'form-1',
      formTitle: '문의 폼',
      formSlug: 'contact',
      totalSubmissions: 42,
      submissionsToday: 5,
      submissionsThisWeek: 12,
      submissionsThisMonth: 23,
      fieldStats: {
        'field-type': {
          fieldId: 'field-type',
          fieldLabel: '유형',
          values: [
            { value: 'artwork', count: 8 },
            { value: 'recording', count: 3 },
          ],
        },
      },
    });

    expect(createPublicFormClientWithAuth).toHaveBeenCalledWith('ko');
    expect(getDashboardMock).toHaveBeenCalledWith({
      slug: 'contact',
      shareToken: 'share-token',
      sharePassword: undefined,
    });
  });

  it('returns null when dashboard data is missing or the RPC fails', async () => {
    getDashboardMock.mockResolvedValueOnce({ dashboard: undefined });
    await expect(
      getFormDashboardByShareAction({
        slug: 'contact',
        shareToken: 'share-token',
        requestedLocale: 'ko',
      }),
    ).resolves.toBeNull();

    getDashboardMock.mockRejectedValueOnce(new ConnectError('boom', Code.Internal));
    await expect(
      getFormDashboardByShareAction({
        slug: 'contact',
        shareToken: 'share-token',
      }),
    ).resolves.toBeNull();
  });

  it('submits public forms while trimming blank passwords', async () => {
    submitMock.mockResolvedValue({});

    await expect(submitFormAction('form-1', { email: 'hello@example.com' }, '   ', 'ko')).resolves.toEqual({
      success: true,
    });

    expect(createPublicFormClientWithAuth).toHaveBeenCalledWith('ko');
    expect(submitMock).toHaveBeenCalledWith({
      formId: 'form-1',
      data: expect.any(Uint8Array),
      password: undefined,
    });
    expect(JSON.parse(new TextDecoder().decode(vi.mocked(submitMock).mock.calls[0]?.[0].data))).toEqual({
      email: 'hello@example.com',
    });
  });

  it('returns RPC error messages when public form submission fails', async () => {
    submitMock.mockRejectedValue(new ConnectError('submit failed', Code.InvalidArgument));

    await expect(submitFormAction('form-1', { email: 'hello@example.com' })).resolves.toEqual({
      error: '[invalid_argument] submit failed',
    });
    expect(createPublicFormClientWithAuth).toHaveBeenCalledWith(undefined);
  });

  it('verifies passwords with trimmed share tokens and passwords', async () => {
    verifyPasswordMock.mockResolvedValue({ valid: true });

    await expect(verifyFormPasswordAction('contact', '  secret  ', ' share-token ')).resolves.toEqual({ valid: true });

    expect(verifyPasswordMock).toHaveBeenCalledWith({
      slug: 'contact',
      password: '  secret  ',
      shareToken: ' share-token ',
      sharePassword: undefined,
    });
  });

  it('returns false when password verification throws', async () => {
    verifyPasswordMock.mockRejectedValue(new ConnectError('bad password', Code.PermissionDenied));

    await expect(verifyFormPasswordAction('contact', 'secret', 'token')).resolves.toEqual({
      valid: false,
    });
  });
});

describe('form admin actions', () => {
  it('maps admin form listings with search, sort, status, and timestamps', async () => {
    const createdAt = new Date('2026-04-04T09:00:00.000Z');
    const updatedAt = new Date('2026-04-04T10:30:00.000Z');
    listFormsAdminMock.mockResolvedValue({
      forms: [
        {
          id: 'form-1',
          title: 'Contact',
          slug: 'contact',
          status: ManageFormStatus.PUBLISHED,
          submissionCount: 12,
          createdAt: timestampFromDate(createdAt),
          updatedAt: timestampFromDate(updatedAt),
        },
      ],
      pagination: { total: 21 },
    });

    await expect(
      listFormsAdminAction({
        page: 2,
        pageSize: 10,
        search: 'contact',
        sort: [{ field: 'updatedAt', order: 'desc' }],
      }),
    ).resolves.toEqual({
      data: [
        {
          id: 'form-1',
          title: 'Contact',
          slug: 'contact',
          status: 'published',
          submissionCount: 12,
          createdAt,
          updatedAt,
        },
      ],
      total: 21,
      page: 2,
      pageSize: 10,
      totalPages: 3,
    });

    expect(listFormsAdminMock).toHaveBeenCalledWith({
      pagination: { limit: 10, offset: 10 },
      filters: [{ field: 'search', op: FilterOp.ILIKE, value: 'contact' }],
      sorts: [{ field: 'updatedAt', order: SortOrder.DESC }],
    });
  });

  it('returns a stable empty admin listing when the RPC fails', async () => {
    listFormsAdminMock.mockRejectedValue(new ConnectError('unavailable', Code.Unavailable));

    await expect(
      listFormsAdminAction({
        page: 3,
        pageSize: 50,
        search: 'contact',
      }),
    ).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });

  it('revalidates the scoped form paths when updating forms', async () => {
    updateFormRpcMock.mockResolvedValue({});

    await expect(updateFormAction('form-1', { title: 'Updated', status: 'draft' })).resolves.toEqual({ success: true });

    expect(updateFormRpcMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'form-1',
        title: 'Updated',
        status: ManageFormStatus.DRAFT,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/admin/forms');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/forms/form-1');
  });

  it('preserves a committed form title update when revalidation fails', async () => {
    updateFormRpcMock.mockResolvedValue({});
    vi.mocked(revalidatePath)
      .mockImplementationOnce(() => {
        throw new Error('cache unavailable');
      })
      .mockImplementationOnce(() => {
        throw new Error('cache unavailable');
      });

    await expect(updateFormAction('form-1', { title: 'Committed' })).resolves.toEqual({
      success: true,
    });
  });

  it('surfaces deletion failures instead of swallowing them', async () => {
    deleteFormRpcMock.mockRejectedValue(new ConnectError('cannot delete', Code.FailedPrecondition));

    await expect(deleteFormAction('form-1')).resolves.toEqual({
      error: '[failed_precondition] cannot delete',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('does not report a committed form delete as failed when cache revalidation throws', async () => {
    deleteFormRpcMock.mockResolvedValue({});
    vi.mocked(revalidatePath).mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });

    await expect(deleteFormAction('form-1')).resolves.toEqual({ success: true });
    expect(deleteFormRpcMock).toHaveBeenCalledWith({ id: 'form-1' });
  });

  it('revalidates scoped featured image changes for set and remove operations', async () => {
    setFeaturedImageMock.mockResolvedValue({
      imageAsset: assetRefFixture('https://cdn.example.com/form.webp'),
      ogGenerationRunId: 'form-featured-run',
    });
    deleteFeaturedImageMock.mockResolvedValue({ ogGenerationRunId: 'form-delete-featured-run' });

    await expect(setFormFeaturedImageAction('form-1', 'file-1', 'my')).resolves.toEqual({
      imageUrl: 'https://cdn.example.com/form.webp',
      ogGenerationRunId: 'form-featured-run',
    });
    await expect(removeFormFeaturedImageAction('form-1', 'my')).resolves.toEqual({
      success: true,
      ogGenerationRunId: 'form-delete-featured-run',
    });

    expect(setFeaturedImageMock).toHaveBeenCalledWith({ formId: 'form-1', fileId: 'file-1' });
    expect(deleteFeaturedImageMock).toHaveBeenCalledWith({ formId: 'form-1' });
    expect(revalidatePath).toHaveBeenCalledWith('/my/forms/form-1');
  });

  it('preserves featured-image OG run identities after a revalidation failure', async () => {
    setFeaturedImageMock.mockResolvedValue({
      imageAsset: assetRefFixture('https://cdn.example.com/form.webp'),
      ogGenerationRunId: 'form-featured-run',
    });
    deleteFeaturedImageMock.mockResolvedValue({ ogGenerationRunId: 'form-delete-featured-run' });
    vi.mocked(revalidatePath)
      .mockImplementationOnce(() => {
        throw new Error('cache unavailable');
      })
      .mockImplementationOnce(() => {
        throw new Error('cache unavailable');
      });

    await expect(setFormFeaturedImageAction('form-1', 'file-1', 'my')).resolves.toEqual({
      imageUrl: 'https://cdn.example.com/form.webp',
      ogGenerationRunId: 'form-featured-run',
    });
    await expect(removeFormFeaturedImageAction('form-1', 'my')).resolves.toEqual({
      success: true,
      ogGenerationRunId: 'form-delete-featured-run',
    });
  });

  it('regenerates the exact Form locale and returns its durable generation identity', async () => {
    await expect(regenerateFormOgImageAction('form-1', ' ko ')).resolves.toEqual({
      success: true,
      runId: 'form-run',
      generationId: 'form-generation',
    });
    expect(regenerateOgImageMock).toHaveBeenCalledWith({
      entityType: 'form',
      entityId: 'form-1',
      selection: { type: 'locale', locale: 'ko' },
    });
  });

  it('rejects a Form regeneration without a concrete locale', async () => {
    await expect(regenerateFormOgImageAction('form-1', '   ')).resolves.toEqual({
      error: 'Locale is required to regenerate this OG image',
    });
    expect(regenerateOgImageMock).not.toHaveBeenCalled();
  });
});

describe('form submission actions', () => {
  it('maps submission listings and decodes stored payloads', async () => {
    const createdAt = new Date('2026-04-04T11:00:00.000Z');
    listSubmissionsMock.mockResolvedValue({
      submissions: [
        {
          id: 'submission-1',
          formId: 'form-1',
          memberId: 'user-1',
          data: new TextEncoder().encode(JSON.stringify({ email: 'hello@example.com' })),
          ipAddress: '127.0.0.1',
          countryCode: 'KR',
          userAgent: 'Mozilla/5.0',
          createdAt: timestampFromDate(createdAt),
        },
      ],
      pagination: { total: 1 },
    });

    await expect(
      listFormSubmissionsAction({
        formId: 'form-1',
        page: 2,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      }),
    ).resolves.toEqual({
      submissions: [
        {
          id: 'submission-1',
          formId: 'form-1',
          memberId: 'user-1',
          data: { email: 'hello@example.com' },
          ipAddress: '127.0.0.1',
          countryCode: 'KR',
          userAgent: 'Mozilla/5.0',
          createdAt,
        },
      ],
      total: 1,
      page: 2,
      limit: 10,
      totalPages: 1,
    });

    expect(listSubmissionsMock).toHaveBeenCalledWith({
      formId: 'form-1',
      pagination: { limit: 10, offset: 10 },
      sorts: [{ field: 'createdAt', order: SortOrder.ASC }],
    });
  });

  it('returns an empty submission listing on RPC failure', async () => {
    listSubmissionsMock.mockRejectedValue(new ConnectError('boom', Code.Internal));

    await expect(listFormSubmissionsAction({ formId: 'form-1' })).resolves.toEqual({
      submissions: [],
      total: 0,
      totalPages: 0,
    });
  });

  it('deletes individual submissions and reports RPC errors', async () => {
    deleteSubmissionMock.mockResolvedValueOnce({});
    await expect(deleteFormSubmissionAction('submission-1')).resolves.toEqual({ success: true });

    deleteSubmissionMock.mockRejectedValueOnce(new ConnectError('cannot delete', Code.Internal));
    await expect(deleteFormSubmissionAction('submission-2')).resolves.toEqual({
      error: '[internal] cannot delete',
    });
  });

  it('returns zeroed stats when no aggregated stats exist', async () => {
    getSubmissionStatsMock.mockResolvedValue({ stats: undefined });

    await expect(getFormSubmissionStatsAction('form-1')).resolves.toEqual({
      totalSubmissions: 0,
      submissionsToday: 0,
      submissionsThisWeek: 0,
      submissionsThisMonth: 0,
      fieldStats: {},
    });
  });

  it('maps aggregated stats and preserves field value counts', async () => {
    getSubmissionStatsMock.mockResolvedValue({
      stats: {
        totalSubmissions: 8,
        submissionsToday: 3,
        submissionsThisWeek: 5,
        submissionsThisMonth: 7,
        fieldStats: [
          {
            fieldId: 'type',
            fieldLabel: 'Type',
            values: [
              { value: 'artwork', count: 5 },
              { value: 'recording', count: 3 },
            ],
          },
        ],
      },
    });

    await expect(getFormSubmissionStatsAction('form-1')).resolves.toEqual({
      totalSubmissions: 8,
      submissionsToday: 3,
      submissionsThisWeek: 5,
      submissionsThisMonth: 7,
      fieldStats: {
        type: {
          fieldId: 'type',
          fieldLabel: 'Type',
          values: [
            { value: 'artwork', count: 5 },
            { value: 'recording', count: 3 },
          ],
        },
      },
    });
  });

  it('returns null when submission stats loading fails', async () => {
    getSubmissionStatsMock.mockRejectedValue(new ConnectError('boom', Code.Internal));

    await expect(getFormSubmissionStatsAction('form-1')).resolves.toBeNull();
  });
});
