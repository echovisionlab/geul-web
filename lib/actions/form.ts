'use server';
import { queryResult, type QueryResult, unwrapQueryResult } from '@/lib/api/query-result';

import { connectActionErrorCode, isConnectError } from '@/lib/api/connect-error';
import {
  actionFailure,
  actionSuccess,
  type ActionResult,
  type LocalActionErrorCode,
} from '@/lib/actions/action-result';
import { revalidatePath } from 'next/cache';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import {
  FormAccessContext,
  FormAccessReason,
  FormAccessTarget,
  FormStatus as PublicFormStatus,
  type Form as PublicApiForm,
} from '@echovisionlab/geul-proto/public/form_pb.ts';
import { FormStatus } from '@echovisionlab/geul-proto/secure/form_pb.ts';
import { ShareLinkEntityType, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { createShareLinkAction, deleteShareLinkAction, listShareLinksAction } from '@/lib/actions/share-link';
import { regenerateOgImageAction as requestOgImageRegeneration } from '@/lib/actions/og-generation';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { createFormClient, createPublicFormClientWithAuth } from '@/lib/api/server-client';
import { mapPublicLocalizationInfo, type PublicLocalizationInfoLike } from '@/lib/queries/localized-public';
import type { AccessReason } from '@/lib/types/form/model';
import type { FormSchema } from '@/lib/types/form/schema';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('form-actions');

interface FormListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
}

type FormScope = 'admin' | 'my';

const toBytes = (json: string): Uint8Array => new TextEncoder().encode(json);
const fromBytes = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

function getFormsBasePath(scope: FormScope): string {
  return scope === 'my' ? '/my/forms' : '/admin/forms';
}

const revalidateFormAfterCommit = createCommittedMutationRevalidator('form-actions', 'form');

function formActionFailure(err: unknown, fallback: string, fallbackCode: LocalActionErrorCode) {
  const message = err instanceof Error ? err.message : fallback;
  return actionFailure(message.trim() ? message : fallback, connectActionErrorCode(err, fallbackCode));
}

export async function listFormsAdminAction(input: FormListInput) {
  return queryResult(async () => {
    const client = await createFormClient();
    const limit = input.pageSize ?? 20;
    const offset = ((input.page ?? 1) - 1) * limit;

    const response = await client.listFormsAdmin({
      pagination: { limit, offset },
      filters: input.search ? [{ field: 'search', op: FilterOp.ILIKE, value: input.search }] : undefined,
      sorts: input.sort?.map((s) => ({
        field: s.field,
        order: s.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
      })),
    });

    const total = response.pagination?.total ?? 0;
    return {
      data: (response.forms ?? []).map((f) => ({
        id: f.id,
        title: f.title,
        slug: f.slug,
        status: f.status === FormStatus.PUBLISHED ? 'published' : 'draft',
        submissionCount: f.submissionCount,
        createdAt: f.createdAt ? timestampDate(f.createdAt) : undefined,
        updatedAt: f.updatedAt ? timestampDate(f.updatedAt) : undefined,
      })),
      total,
      page: input.page ?? 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

export async function createFormAction(title: string): Promise<ActionResult<{ data: { id: string } }>> {
  try {
    const client = await createFormClient();
    const schema = {
      id: crypto.randomUUID(),
      steps: [{ id: crypto.randomUUID(), title: 'Step 1' }],
    };
    const form = await client.createForm({
      title,
      schema: toBytes(JSON.stringify(schema)),
      isPublic: false,
    });
    revalidatePath('/admin/forms');
    return actionSuccess({ data: { id: form.id } });
  } catch (err) {
    return formActionFailure(err, 'Failed to create form', 'FORM_CREATE_FAILED');
  }
}

export async function deleteFormAction(id: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createFormClient();
    await client.deleteForm({ id });
    revalidateFormAfterCommit('/admin/forms');
    return actionSuccess({ success: true });
  } catch (err) {
    return formActionFailure(err, 'Failed to delete form', 'FORM_DELETE_FAILED');
  }
}

export interface UpdateFormInput {
  title?: string;
  status?: 'draft' | 'published';
  slug?: string | null;
  isPublic?: boolean;
  password?: string;
  opensAt?: Date | null;
  closesAt?: Date | null;
  maxSubmissions?: number | null;
  requireAuth?: boolean;
  allowedRoles?: string[];
  allowDuplicateSubmission?: boolean;
}

export async function updateFormAction(id: string, data: UpdateFormInput): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createFormClient();
    await client.updateForm({
      id,
      title: data.title,
      slug: data.slug === null ? undefined : data.slug,
      clearSlug: data.slug === null,
      isPublic: data.isPublic,
      password: data.password,
      opensAt: data.opensAt instanceof Date ? timestampFromDate(data.opensAt) : undefined,
      clearOpensAt: data.opensAt === null,
      closesAt: data.closesAt instanceof Date ? timestampFromDate(data.closesAt) : undefined,
      clearClosesAt: data.closesAt === null,
      maxSubmissions: data.maxSubmissions === null ? undefined : data.maxSubmissions,
      clearMaxSubmissions: data.maxSubmissions === null,
      requireAuth: data.requireAuth,
      allowedRoles: data.allowedRoles,
      replaceAllowedRoles: data.allowedRoles !== undefined,
      allowDuplicateSubmission: data.allowDuplicateSubmission,
      status:
        data.status === 'published' ? FormStatus.PUBLISHED : data.status === 'draft' ? FormStatus.DRAFT : undefined,
    });
    const basePath = getFormsBasePath('admin');
    revalidateFormAfterCommit(basePath);
    revalidateFormAfterCommit(`${basePath}/${id}`);
    return actionSuccess({ success: true });
  } catch (err) {
    return formActionFailure(err, 'Failed to update form', 'FORM_UPDATE_FAILED');
  }
}

export async function setFormFeaturedImageAction(
  formId: string,
  fileId: string,
  scope: FormScope = 'admin',
): Promise<ActionResult<{ imageUrl?: string; ogGenerationRunId?: string }>> {
  try {
    const client = await createFormClient();
    const result = await client.setFormFeaturedImage({ formId, fileId });
    revalidateFormAfterCommit(`${getFormsBasePath(scope)}/${formId}`);
    const response = { imageUrl: result.imageAsset?.url };
    return actionSuccess(
      result.ogGenerationRunId ? { ...response, ogGenerationRunId: result.ogGenerationRunId } : response,
    );
  } catch (err) {
    return formActionFailure(err, 'Failed to set featured image', 'FORM_SET_FEATURED_IMAGE_FAILED');
  }
}

export async function removeFormFeaturedImageAction(
  formId: string,
  scope: FormScope = 'admin',
): Promise<ActionResult<{ success: true; ogGenerationRunId?: string }>> {
  try {
    const client = await createFormClient();
    const result = await client.deleteFormFeaturedImage({ formId });
    revalidateFormAfterCommit(`${getFormsBasePath(scope)}/${formId}`);
    return actionSuccess(
      result.ogGenerationRunId ? { success: true, ogGenerationRunId: result.ogGenerationRunId } : { success: true },
    );
  } catch (err) {
    return formActionFailure(err, 'Failed to remove featured image', 'FORM_REMOVE_FEATURED_IMAGE_FAILED');
  }
}

export async function regenerateFormOgImageAction(
  formId: string,
  locale: string,
): Promise<ActionResult<{ success: true; runId?: string; generationId?: string }>> {
  const scopedLocale = locale.trim();
  if (!scopedLocale) {
    return actionFailure('Locale is required to regenerate this OG image', 'ACTION_INVALID_LOCALE');
  }
  const result = await requestOgImageRegeneration({
    entityType: 'form',
    entityId: formId,
    selection: { type: 'locale', locale: scopedLocale },
  });
  if (!result.ok) {
    return actionFailure(result.error, result.errorCode);
  }
  return actionSuccess({ success: true, runId: result.runId, generationId: result.generationIds?.[0] });
}

interface ListSubmissionsInput {
  formId: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'createdAt';
  sortOrder?: 'asc' | 'desc';
  countryCode?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface FormSubmissionsListData {
  submissions: Array<{
    id: string;
    formId: string;
    memberId: string | undefined;
    data: unknown;
    ipAddress: string | undefined;
    countryCode: string | undefined;
    userAgent: string | undefined;
    createdAt: Date | undefined;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listFormSubmissionsAction(
  input: ListSubmissionsInput,
): Promise<ActionResult<{ data: FormSubmissionsListData }, { code: 'LIST_SUBMISSIONS_FAILED' }>> {
  try {
    const client = await createFormClient();
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const offset = (page - 1) * limit;

    const response = await client.listFormSubmissions({
      formId: input.formId,
      pagination: { limit, offset },
      sorts: input.sortBy
        ? [
            {
              field: input.sortBy,
              order: input.sortOrder === 'asc' ? SortOrder.ASC : SortOrder.DESC,
            },
          ]
        : [],
      ...(input.search ? { search: input.search } : {}),
      ...(input.countryCode?.trim() ? { countryCode: input.countryCode.trim().toUpperCase() } : {}),
      ...(input.dateFrom ? { createdAtFrom: timestampFromDate(new Date(input.dateFrom)) } : {}),
      ...(input.dateTo ? { createdAtBefore: timestampFromDate(new Date(input.dateTo)) } : {}),
    });

    const total = response.pagination?.total ?? 0;
    return actionSuccess({
      data: {
        submissions: (response.submissions ?? []).map((s) => ({
          id: s.id,
          formId: s.formId,
          memberId: s.memberId,
          data: JSON.parse(fromBytes(s.data)),
          ipAddress: s.ipAddress,
          countryCode: s.countryCode,
          userAgent: s.userAgent,
          createdAt: s.createdAt ? timestampDate(s.createdAt) : undefined,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListFormSubmissions RPC error', { error: err.message });
    }
    return actionFailure('Failed to list form submissions', connectActionErrorCode(err, 'LIST_SUBMISSIONS_FAILED'), {
      code: 'LIST_SUBMISSIONS_FAILED' as const,
    });
  }
}

export async function deleteFormSubmissionAction(id: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createFormClient();
    await client.deleteFormSubmission({ id });
    return actionSuccess({ success: true });
  } catch (err) {
    return formActionFailure(err, 'Failed to delete submission', 'FORM_DELETE_SUBMISSION_FAILED');
  }
}

// Public: submit form response
export async function submitFormAction(
  formId: string,
  data: Record<string, unknown>,
  password?: string,
  requestedLocale?: string,
): Promise<ActionResult<{ success: true }>> {
  try {
    const publicClient = await createPublicFormClientWithAuth(requestedLocale);
    const normalizedPassword = password?.trim() ? password : undefined;

    await publicClient.submit({
      formId,
      data: toBytes(JSON.stringify(data)),
      password: normalizedPassword,
    });

    return actionSuccess({ success: true });
  } catch (err) {
    return formActionFailure(err, 'Failed to submit form', 'FORM_SUBMIT_FAILED');
  }
}

// Public: verify form password
export async function verifyFormPasswordAction(
  slug: string,
  password: string,
  shareToken?: string,
  sharePassword?: string,
): Promise<QueryResult<{ valid: boolean }>> {
  return queryResult(async () => {
    const client = await createPublicFormClientWithAuth();
    const response = await client.verifyPassword({
      slug,
      password,
      shareToken: shareToken?.trim() ? shareToken : undefined,
      sharePassword: sharePassword?.trim() ? sharePassword : undefined,
    });
    return { valid: response.valid };
  });
}

// Share links - uses generic ShareLinkService
export async function listFormShareLinksAction(
  formId: string,
  type: ShareLinkEntityType.FORM | ShareLinkEntityType.FORM_DASHBOARD,
): Promise<ShareLinkItem[]> {
  return listShareLinksAction(type, formId).then(unwrapQueryResult);
}

export async function createFormShareLinkAction(data: {
  formId: string;
  type: ShareLinkEntityType.FORM | ShareLinkEntityType.FORM_DASHBOARD;
  label?: string;
  expiresAt?: Date;
  password?: string;
}): Promise<ActionResult<{ shareLink: ShareLinkItem }>> {
  return createShareLinkAction(data.type, data.formId, {
    label: data.label,
    expiresAt: data.expiresAt,
    password: data.password,
  });
}

export async function deleteFormShareLinkAction(id: string): Promise<ActionResult<{ success: true }>> {
  return deleteShareLinkAction(id);
}

// ============================================================================
// Public Form Access Actions
// ============================================================================

export interface PublicFormData {
  id: string;
  title: string;
  slug: string;
  schema: FormSchema;
  status: 'published' | 'draft';
  isPublic: boolean;
  requireAuth: boolean;
  allowedRoles: string[];
  allowDuplicateSubmission: boolean;
  hasPassword: boolean;
  maxSubmissions?: number;
  opensAt?: Date;
  closesAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  localizationInfo?: PublicLocalizationInfoLike | null;
}

export type FormAccessFailureReason = AccessReason | 'server_error';

export interface FormAccessData {
  accessible: boolean;
  reason?: FormAccessFailureReason;
  requiresPassword?: boolean;
  form?: PublicFormData | null;
}

type FormAccessContextInput = 'url' | 'embed';
type FormAccessTargetInput = 'form' | 'dashboard';

export interface CheckFormAccessInput {
  slug: string;
  context: FormAccessContextInput;
  shareToken?: string;
  sharePassword?: string;
  password?: string;
  target?: FormAccessTargetInput;
  requestedLocale?: string;
}

function toPublicFormData(form: PublicApiForm, fallbackSlug: string): PublicFormData {
  const localizationInfo = mapPublicLocalizationInfo(form.localizationInfo);
  return {
    id: form.id,
    title: form.title,
    slug: form.slug ?? fallbackSlug,
    schema: JSON.parse(fromBytes(form.schema)),
    status: form.status === PublicFormStatus.PUBLISHED ? 'published' : 'draft',
    isPublic: form.isPublic,
    requireAuth: form.requireAuth,
    allowedRoles: form.allowedRoles,
    allowDuplicateSubmission: form.allowDuplicateSubmission,
    hasPassword: form.hasPassword,
    maxSubmissions: form.maxSubmissions,
    opensAt: form.opensAt ? timestampDate(form.opensAt) : undefined,
    closesAt: form.closesAt ? timestampDate(form.closesAt) : undefined,
    createdAt: form.createdAt ? timestampDate(form.createdAt) : undefined,
    updatedAt: form.updatedAt ? timestampDate(form.updatedAt) : undefined,
    ...(localizationInfo ? { localizationInfo } : {}),
  };
}

function mapFormAccessReason(reason: FormAccessReason): FormAccessFailureReason | undefined {
  switch (reason) {
    case FormAccessReason.FORM_NOT_FOUND:
      return 'form_not_found';
    case FormAccessReason.FORM_NOT_PUBLISHED:
      return 'form_not_published';
    case FormAccessReason.NOT_PUBLIC:
      return 'not_public';
    case FormAccessReason.AUTH_REQUIRED:
      return 'auth_required';
    case FormAccessReason.ROLE_NOT_ALLOWED:
      return 'role_not_allowed';
    case FormAccessReason.PASSWORD_REQUIRED:
      return 'password_required';
    case FormAccessReason.ALREADY_SUBMITTED:
      return 'already_submitted';
    case FormAccessReason.NOT_YET_OPEN:
      return 'not_yet_open';
    case FormAccessReason.CLOSED:
      return 'closed';
    case FormAccessReason.MAX_SUBMISSIONS_REACHED:
      return 'max_submissions_reached';
    default:
      return undefined;
  }
}

export async function checkFormAccessAction(input: CheckFormAccessInput): Promise<FormAccessData> {
  try {
    const client = await createPublicFormClientWithAuth(input.requestedLocale);
    const response = await client.checkAccess({
      slug: input.slug,
      shareToken: input.shareToken?.trim() ? input.shareToken : undefined,
      sharePassword: input.sharePassword?.trim() ? input.sharePassword : undefined,
      password: input.password?.trim() ? input.password : undefined,
      context: input.context === 'embed' ? FormAccessContext.EMBED : FormAccessContext.URL,
      target: input.target === 'dashboard' ? FormAccessTarget.DASHBOARD : FormAccessTarget.FORM,
    });

    const reason = mapFormAccessReason(response.reason);

    if (response.accessible && response.form) {
      const form = toPublicFormData(response.form, input.slug);
      return {
        accessible: true,
        form,
      };
    }

    return {
      accessible: false,
      reason: reason ?? 'server_error',
      requiresPassword: reason === 'password_required',
      form: null,
    };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.NotFound) {
        return { accessible: false, reason: 'form_not_found', form: null };
      }
      if (err.code === Code.Unauthenticated) {
        return { accessible: false, reason: 'auth_required', form: null };
      }
      if (err.code === Code.PermissionDenied) {
        return { accessible: false, reason: 'role_not_allowed', form: null };
      }
      logger.error('CheckFormAccessibility RPC error', { error: err.message });
    }
    return { accessible: false, reason: 'server_error', form: null };
  }
}

// Public: Check URL accessibility by slug (with optional share token)
export async function checkFormAccessibilityBySlugAction(
  slug: string,
  shareToken?: string,
  requestedLocale?: string,
): Promise<FormAccessData> {
  return checkFormAccessAction({
    slug,
    shareToken,
    context: 'url',
    requestedLocale,
  });
}

export interface PublicFormDashboardData {
  formId: string;
  formTitle: string;
  formSlug: string;
  totalSubmissions: number;
  submissionsToday: number;
  submissionsThisWeek: number;
  submissionsThisMonth: number;
  fieldStats: Record<
    string,
    {
      fieldId: string;
      fieldLabel: string;
      values: { value: string; count: number }[];
    }
  >;
}

export async function getFormDashboardByShareAction(input: {
  slug: string;
  shareToken: string;
  sharePassword?: string;
  requestedLocale?: string;
}): Promise<QueryResult<PublicFormDashboardData | null>> {
  return queryResult(async () => {
    const client = await createPublicFormClientWithAuth(input.requestedLocale);
    const response = await client.getDashboard({
      slug: input.slug,
      shareToken: input.shareToken.trim(),
      sharePassword: input.sharePassword?.trim() ? input.sharePassword : undefined,
    });
    const dashboard = response.dashboard;
    if (!dashboard) {
      return null;
    }

    const fieldStats: PublicFormDashboardData['fieldStats'] = {};
    for (const fieldStat of dashboard.fieldStats) {
      fieldStats[fieldStat.fieldId] = {
        fieldId: fieldStat.fieldId,
        fieldLabel: fieldStat.fieldLabel,
        values: fieldStat.values.map((v) => ({ value: v.value, count: v.count })),
      };
    }

    return {
      formId: dashboard.formId,
      formTitle: dashboard.formTitle,
      formSlug: dashboard.formSlug,
      totalSubmissions: dashboard.totalSubmissions,
      submissionsToday: dashboard.submissionsToday,
      submissionsThisWeek: dashboard.submissionsThisWeek,
      submissionsThisMonth: dashboard.submissionsThisMonth,
      fieldStats,
    };
  });
}

// Public: Get form submission stats for dashboard
export interface FormSubmissionStats {
  totalSubmissions: number;
  submissionsToday: number;
  submissionsThisWeek: number;
  submissionsThisMonth: number;
  fieldStats: Record<
    string,
    {
      fieldId: string;
      fieldLabel: string;
      values: { value: string; count: number }[];
    }
  >;
}

export async function getFormSubmissionStatsAction(formId: string): Promise<QueryResult<FormSubmissionStats | null>> {
  return queryResult(async () => {
    const client = await createFormClient();
    const response = await client.getFormSubmissionStats({ formId });
    const stats = response.stats;
    if (!stats) {
      return {
        totalSubmissions: 0,
        submissionsToday: 0,
        submissionsThisWeek: 0,
        submissionsThisMonth: 0,
        fieldStats: {},
      };
    }

    const fieldStats: FormSubmissionStats['fieldStats'] = {};
    for (const fieldStat of stats.fieldStats ?? []) {
      fieldStats[fieldStat.fieldId] = {
        fieldId: fieldStat.fieldId,
        fieldLabel: fieldStat.fieldLabel,
        values: fieldStat.values.map((v) => ({ value: v.value, count: v.count })),
      };
    }

    return {
      totalSubmissions: stats.totalSubmissions,
      submissionsToday: stats.submissionsToday,
      submissionsThisWeek: stats.submissionsThisWeek,
      submissionsThisMonth: stats.submissionsThisMonth,
      fieldStats,
    };
  });
}
