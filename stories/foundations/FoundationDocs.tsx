import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { getLocaleDirection } from '@/lib/i18n/locale';
import { LayoutStack } from '@/components/core/Layout';
import { Heading, Text } from '@/components/core/Typography';
import { ScrollArea } from '@/components/core/Display';
import { StorybookLink } from '../shared/StorybookLink';
import classes from './FoundationDocs.module.css';

/** Product specimen copy follows the shared preview locale; documentation stays English. */
export function useFoundationUI() {
  const locale = useLocale();
  const fixtureText = useStorybookText();
  return (english: string, korean?: string) => (locale === 'ko' && korean ? korean : fixtureText(english));
}

/** Restore product language/direction inside English documentation without replacing its provider. */
export function LocalizedSpecimen({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return (
    <div lang={locale} dir={getLocaleDirection(locale)} data-foundation-specimen>
      {children}
    </div>
  );
}

export function FoundationDoc({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className={classes.document} lang="en" dir="ltr">
      <LayoutStack gap="section">
        <LayoutStack gap="xs">
          <Heading level={1} scale={{ base: 3, sm: 2 }} wrap="anywhere">
            {title}
          </Heading>
          <Text size="sm" tone="secondary">
            {description}
          </Text>
        </LayoutStack>
        {children}
      </LayoutStack>
    </main>
  );
}

export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <LayoutStack as="section" gap="sm">
      <Heading level={2} scale={4}>
        {title}
      </Heading>
      {children}
    </LayoutStack>
  );
}

export function DocTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly string[];
  rows: ReadonlyArray<readonly ReactNode[]>;
}) {
  return (
    <div className={classes.tableScroll}>
      <ScrollArea role="region" aria-label={caption} scrollbars="x">
        <table className={`${classes.table}${columns.length >= 4 ? ` ${classes.wideTable}` : ''}`}>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>No matching entries.</td>
              </tr>
            ) : null}
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

export function StoryLink({ id, children }: { id: string; children: ReactNode }) {
  return <StorybookLink href={`/?path=/story/${id}`}>{children}</StorybookLink>;
}

export function CodeExample({ children }: { children: string }) {
  return (
    <pre className={classes.code}>
      <code>{children}</code>
    </pre>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <Text size="xs" tone="secondary" font="mono" wrap="anywhere">
      {children}
    </Text>
  );
}
