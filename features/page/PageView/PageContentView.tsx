// Server Component - no 'use client'
import { ContentChrome, ContentLayoutView, type DocumentLayout } from '@/features/document-layout';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { LocalizedPageSection } from '@/features/editor/contract/localized-page';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { LocalizationNotice } from '@/features/translation/LocalizationNotice';
import { PrintButton } from '@/features/print/PrintButton';
import { GeneratedPageRenderer } from './GeneratedPageRenderer';
import classes from './PageContentView.module.css';

interface PageContentViewProps {
  page: {
    title: string;
    showTitle: boolean;
    content: LocalizedPageSection[] | null;
    blockMedia: readonly ContentBlockMediaItem[];
    documentLayout: DocumentLayout;
    localizationInfo?: {
      requestedLocale: string;
      displayedLocale: string;
      sourceLocale: string;
      isFallback: boolean;
      isOriginal: boolean;
      machineGenerated: boolean;
      fallbackReason: number;
      availableLocales?: string[];
    } | null;
  };
  pathname: string;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale: string;
}

export function PageContentView({ page, pathname, query, requestedLocale }: PageContentViewProps) {
  const controls = (
    <div className={classes.controls}>
      {page.localizationInfo ? (
        <ContentLanguageMenu
          pathname={pathname}
          query={query}
          requestedLocale={requestedLocale}
          localizationInfo={page.localizationInfo}
        />
      ) : null}
      <PrintButton />
    </div>
  );
  const showTitle = page.showTitle && !!page.title;
  const chrome = <ContentChrome title={showTitle ? page.title : undefined} controls={controls} />;

  return (
    <ContentBlockMediaRuntimeProvider items={page.blockMedia}>
      <ContentLayoutView layout={page.documentLayout} chrome={chrome} className="page-content">
        {page.localizationInfo ? (
          <LocalizationNotice
            pathname={pathname}
            query={query}
            requestedLocale={requestedLocale}
            localizationInfo={page.localizationInfo}
          />
        ) : null}
        <GeneratedPageRenderer sections={page.content ?? []} query={query} requestedLocale={requestedLocale} />
      </ContentLayoutView>
    </ContentBlockMediaRuntimeProvider>
  );
}
