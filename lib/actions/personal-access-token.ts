'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import type { PersonalAccessToken } from '@echovisionlab/geul-proto/secure/account_pb.ts';
import { createAccountClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';
import { getSession } from '@/lib/utils/session.server';

const logger = createLogger('personal-access-token-actions');

export interface PersonalAccessTokenSummary {
  id: string;
  createdAt: string;
}

export type PersonalAccessTokenActionError =
  | 'not_authenticated'
  | 'not_authorized'
  | 'reauth_required'
  | 'invalid_request'
  | 'invalid_response'
  | 'request_failed';

export interface ListPersonalAccessTokensActionResult {
  personalAccessTokens: PersonalAccessTokenSummary[];
  error?: PersonalAccessTokenActionError;
}

export interface PersonalAccessTokenSecretActionResult {
  personalAccessToken?: PersonalAccessTokenSummary;
  secret?: string;
  error?: PersonalAccessTokenActionError;
}

export interface DeletePersonalAccessTokenActionResult {
  deleted: boolean;
  error?: PersonalAccessTokenActionError;
}

function normalizeIdentifier(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapPersonalAccessToken(token: PersonalAccessToken | undefined): PersonalAccessTokenSummary | null {
  const id = normalizeIdentifier(token?.id);
  if (!id || !token?.createdAt) {
    return null;
  }
  const createdAt = timestampDate(token.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return null;
  }
  return { id, createdAt: createdAt.toISOString() };
}

function mapPersonalAccessTokenList(tokens: PersonalAccessToken[]): ListPersonalAccessTokensActionResult {
  if (tokens.length > 1) {
    return { personalAccessTokens: [], error: 'invalid_response' };
  }
  const mapped = tokens.map(mapPersonalAccessToken);
  if (mapped.some((token) => token === null)) {
    return { personalAccessTokens: [], error: 'invalid_response' };
  }
  return { personalAccessTokens: mapped.filter((token): token is PersonalAccessTokenSummary => token !== null) };
}

function mapSecretResponse(
  personalAccessToken: PersonalAccessToken | undefined,
  secret: string,
): PersonalAccessTokenSecretActionResult {
  const token = mapPersonalAccessToken(personalAccessToken);
  return token && secret ? { personalAccessToken: token, secret } : { error: 'invalid_response' };
}

function mapActionError(error: unknown): PersonalAccessTokenActionError {
  if (isConnectError(error)) {
    if (error.code === Code.Unauthenticated) {
      return 'not_authenticated';
    }
    if (error.code === Code.PermissionDenied) {
      return 'not_authorized';
    }
    if (
      error.code === Code.FailedPrecondition &&
      (error.message.toLowerCase().includes('reauthenticate') || error.message.toLowerCase().includes('fresh'))
    ) {
      return 'reauth_required';
    }
  }
  return 'request_failed';
}

async function hasAuthenticatedMember(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session?.user?.id);
}

export async function listMyPersonalAccessTokensAction(): Promise<ListPersonalAccessTokensActionResult> {
  if (!(await hasAuthenticatedMember())) {
    return { personalAccessTokens: [], error: 'not_authenticated' };
  }
  try {
    const client = await createAccountClient();
    const response = await client.listMyPersonalAccessTokens({});
    return mapPersonalAccessTokenList(response.personalAccessTokens);
  } catch (error) {
    logger.error('Failed to list personal access token', { error });
    return { personalAccessTokens: [], error: mapActionError(error) };
  }
}

export async function createMyPersonalAccessTokenAction(): Promise<PersonalAccessTokenSecretActionResult> {
  if (!(await hasAuthenticatedMember())) {
    return { error: 'not_authenticated' };
  }
  try {
    const client = await createAccountClient();
    const response = await client.createMyPersonalAccessToken({});
    return mapSecretResponse(response.personalAccessToken, response.secret);
  } catch (error) {
    logger.error('Failed to create personal access token', { error });
    return { error: mapActionError(error) };
  }
}

export async function regenerateMyPersonalAccessTokenAction(
  personalAccessTokenId: string,
): Promise<PersonalAccessTokenSecretActionResult> {
  const id = normalizeIdentifier(personalAccessTokenId);
  if (!id) {
    return { error: 'invalid_request' };
  }
  if (!(await hasAuthenticatedMember())) {
    return { error: 'not_authenticated' };
  }
  try {
    const client = await createAccountClient();
    const response = await client.regenerateMyPersonalAccessToken({ personalAccessTokenId: id });
    return mapSecretResponse(response.personalAccessToken, response.secret);
  } catch (error) {
    logger.error('Failed to regenerate personal access token', { error });
    return { error: mapActionError(error) };
  }
}

export async function deleteMyPersonalAccessTokenAction(
  personalAccessTokenId: string,
): Promise<DeletePersonalAccessTokenActionResult> {
  const id = normalizeIdentifier(personalAccessTokenId);
  if (!id) {
    return { deleted: false, error: 'invalid_request' };
  }
  if (!(await hasAuthenticatedMember())) {
    return { deleted: false, error: 'not_authenticated' };
  }
  try {
    const client = await createAccountClient();
    const response = await client.deleteMyPersonalAccessToken({ personalAccessTokenId: id });
    return { deleted: response.deleted };
  } catch (error) {
    logger.error('Failed to delete personal access token', { error });
    return { deleted: false, error: mapActionError(error) };
  }
}

export async function listAccountPersonalAccessTokensAction(
  memberId: string,
): Promise<ListPersonalAccessTokensActionResult> {
  const id = normalizeIdentifier(memberId);
  if (!id) {
    return { personalAccessTokens: [], error: 'invalid_request' };
  }
  if (!(await hasAuthenticatedMember())) {
    return { personalAccessTokens: [], error: 'not_authenticated' };
  }
  try {
    const client = await createAccountClient();
    const response = await client.listAccountPersonalAccessTokens({ memberId: id });
    return mapPersonalAccessTokenList(response.personalAccessTokens);
  } catch (error) {
    logger.error('Failed to list account personal access token', { error });
    return { personalAccessTokens: [], error: mapActionError(error) };
  }
}

export async function createAccountPersonalAccessTokenAction(
  memberId: string,
): Promise<PersonalAccessTokenSecretActionResult> {
  const id = normalizeIdentifier(memberId);
  if (!id) {
    return { error: 'invalid_request' };
  }
  if (!(await hasAuthenticatedMember())) {
    return { error: 'not_authenticated' };
  }
  try {
    const client = await createAccountClient();
    const response = await client.createAccountPersonalAccessToken({ memberId: id });
    return mapSecretResponse(response.personalAccessToken, response.secret);
  } catch (error) {
    logger.error('Failed to create account personal access token', { error });
    return { error: mapActionError(error) };
  }
}

export async function regenerateAccountPersonalAccessTokenAction(
  memberId: string,
  personalAccessTokenId: string,
): Promise<PersonalAccessTokenSecretActionResult> {
  const subject = normalizeIdentifier(memberId);
  const token = normalizeIdentifier(personalAccessTokenId);
  if (!subject || !token) {
    return { error: 'invalid_request' };
  }
  if (!(await hasAuthenticatedMember())) {
    return { error: 'not_authenticated' };
  }
  try {
    const client = await createAccountClient();
    const response = await client.regenerateAccountPersonalAccessToken({
      memberId: subject,
      personalAccessTokenId: token,
    });
    return mapSecretResponse(response.personalAccessToken, response.secret);
  } catch (error) {
    logger.error('Failed to regenerate account personal access token', { error });
    return { error: mapActionError(error) };
  }
}

export async function deleteAccountPersonalAccessTokenAction(
  memberId: string,
  personalAccessTokenId: string,
): Promise<DeletePersonalAccessTokenActionResult> {
  const subject = normalizeIdentifier(memberId);
  const token = normalizeIdentifier(personalAccessTokenId);
  if (!subject || !token) {
    return { deleted: false, error: 'invalid_request' };
  }
  if (!(await hasAuthenticatedMember())) {
    return { deleted: false, error: 'not_authenticated' };
  }
  try {
    const client = await createAccountClient();
    const response = await client.deleteAccountPersonalAccessToken({
      memberId: subject,
      personalAccessTokenId: token,
    });
    return { deleted: response.deleted };
  } catch (error) {
    logger.error('Failed to delete account personal access token', { error });
    return { deleted: false, error: mapActionError(error) };
  }
}
