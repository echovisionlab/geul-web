import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { ShareLinkEntityType } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { createPublicShareLinkClient } from '@/lib/api/server-client';
import { getPostAllowedActions, getPostViewWithToken } from '@/lib/queries/post';
import { getPageViewWithToken } from '@/lib/queries/page';
import { getUserLocale } from '@/lib/utils/language.server';
import { PageShareContent } from './PageShareContent';
import { PageShareViewClient } from './PageShareViewClient';
import { PostShareViewClient } from './PostShareViewClient';
import { LegalShareViewClient } from './LegalShareViewClient';
import { FormShareViewClient } from './FormShareViewClient';
import { checkFormAccessAction } from '@/lib/actions/form';
import { getLegalShareDocument, isPublicLegalHistoryVersion } from './legal-share-query';

export const metadata: Metadata = { robots: { index: false, follow: false } };

function nonPostDestination(entityType: ShareLinkEntityType, id: string, slug: string | undefined, token: string) {
  const target = encodeURIComponent(slug || id);
  const share = encodeURIComponent(token);
  switch (entityType) {
    case ShareLinkEntityType.WORK:
      return `/works/${target}?share=${share}`;
    case ShareLinkEntityType.RELEASE:
      return `/releases/${target}?share=${share}`;
    case ShareLinkEntityType.FORM:
      return `/forms/${target}?share=${share}`;
    case ShareLinkEntityType.FORM_DASHBOARD:
      return `/forms/${target}/dashboard?share=${share}`;
    case ShareLinkEntityType.ARTIST:
      return `/artists/${target}?share=${share}`;
    case ShareLinkEntityType.LABEL:
      return `/labels/${target}?share=${share}`;
    case ShareLinkEntityType.PRIVACY:
      return `/privacy?preview=${encodeURIComponent(id)}&token=${share}`;
    case ShareLinkEntityType.TERMS:
      return `/terms?preview=${encodeURIComponent(id)}&token=${share}`;
    default:
      return null;
  }
}

export default async function ShareLinkPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const response = await createPublicShareLinkClient()
    .validate({ token })
    .catch(() => null);
  if (!response?.entityType || !response.entityId || (!response.valid && !response.passwordRequired)) {
    notFound();
  }

  const locale = await getUserLocale();
  if (response.entityType === ShareLinkEntityType.PAGE) {
    const idOrSlug = response.slug || response.entityId;
    const page = response.passwordRequired ? null : await getPageViewWithToken(idOrSlug, token, locale);
    if (!response.passwordRequired && !page) {
      notFound();
    }
    return (
      <PageShareViewClient
        token={token}
        idOrSlug={idOrSlug}
        requestedLocale={locale}
        initialState={
          page
            ? {
                content: <PageShareContent page={page} token={token} requestedLocale={locale} />,
              }
            : {}
        }
      />
    );
  }

  if (response.entityType === ShareLinkEntityType.PRIVACY || response.entityType === ShareLinkEntityType.TERMS) {
    const entityType = response.entityType === ShareLinkEntityType.PRIVACY ? 'privacy' : 'terms';
    const document = response.passwordRequired
      ? null
      : await getLegalShareDocument(entityType, response.entityId, token, locale);
    if (!response.passwordRequired && !document) {
      if (await isPublicLegalHistoryVersion(entityType, response.entityId, locale)) {
        redirect(`/${entityType}/history/${encodeURIComponent(response.entityId)}`);
      }
      notFound();
    }
    return (
      <LegalShareViewClient
        entityType={entityType}
        entityId={response.entityId}
        token={token}
        requestedLocale={locale}
        initialState={document ? { document } : {}}
      />
    );
  }

  if (response.entityType === ShareLinkEntityType.FORM || response.entityType === ShareLinkEntityType.FORM_DASHBOARD) {
    const idOrSlug = response.slug || response.entityId;
    const target = response.entityType === ShareLinkEntityType.FORM_DASHBOARD ? 'dashboard' : 'form';
    const access = response.passwordRequired
      ? null
      : await checkFormAccessAction({
          slug: idOrSlug,
          context: 'url',
          target,
          shareToken: token,
          requestedLocale: locale,
        });
    if (!response.passwordRequired && !access?.accessible) {
      notFound();
    }
    return (
      <FormShareViewClient
        token={token}
        idOrSlug={idOrSlug}
        requestedLocale={locale}
        target={target}
        initialState={
          target === 'dashboard' ? { granted: access?.accessible === true } : access?.form ? { form: access.form } : {}
        }
        passwordRequired={response.passwordRequired}
      />
    );
  }

  if (response.entityType !== ShareLinkEntityType.POST) {
    const destination = nonPostDestination(response.entityType, response.entityId, response.slug, token);
    if (!destination) {
      notFound();
    }
    redirect(destination);
  }

  const idOrSlug = response.slug || response.entityId;
  const post = response.passwordRequired ? null : await getPostViewWithToken(idOrSlug, token, locale);
  if (!response.passwordRequired && !post) {
    notFound();
  }
  const initialState = post ? { post, allowedActions: await getPostAllowedActions(post.id).catch(() => []) } : {};

  return (
    <PostShareViewClient
      token={token}
      idOrSlug={idOrSlug}
      requestedLocale={locale}
      initialState={initialState}
      passwordRequired={response.passwordRequired}
    />
  );
}
