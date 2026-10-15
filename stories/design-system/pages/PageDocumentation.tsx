import { useState } from 'react';

import { Alert } from '@/components/core/Alert';
import { DataTableView } from '@/components/core/DataTable/DataTableView';
import { Disclosure } from '@/components/core/Disclosure';
import { Select, TextInput } from '@/components/core/Input';
import { LayoutContainer, LayoutGrid, LayoutInline, LayoutStack } from '@/components/core/Layout';
import { SectionCard } from '@/components/core/Section';
import { Heading, Text } from '@/components/core/Typography';
import { StorybookLink } from '../../shared/StorybookLink';
import {
  getPageDocumentation,
  pageDocumentation,
  pageReviewChecks,
  pageSourceManifestHash,
  pageViewportChecks,
  previewStateGroups,
  storyIdFromPreview,
  type DocumentationText,
  type GeneratedState,
  type PageDocumentationRecord,
  type PagePreviewDocumentation,
} from './page-docs';

const dispositionLabels: Record<string, DocumentationText> = {
  'page-view-preview': 'Page View mapped to a story',
  'layout-view-preview': 'Shell View mapped to a story',
  'boundary-view-preview': 'Boundary View mapped to a story',
  'redirect-only': 'Redirect without a page surface',
  'terminal-not-found-only': 'Terminates with notFound',
  'disabled-by-terminal-layout': 'Blocked by a terminal parent layout',
  'development-only-entry': 'Development only',
  'provider-document-layout': 'Document and provider layout',
};

/** Escape identities without collapsing distinct route paths or story titles. */
function headingIdentity(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, (character) => `_${character.charCodeAt(0).toString(16)}_`);
}

function StateLinks({ states }: { states: GeneratedState[] }) {
  return (
    <LayoutInline gap="action-group" wrap="wrap">
      {states.map((state) => {
        const id = storyIdFromPreview(state.preview);
        return id ? (
          <StorybookLink key={id} href={`/?path=/story/${id}`}>
            {state.variant}
          </StorybookLink>
        ) : null;
      })}
    </LayoutInline>
  );
}

function SourceList({ sources }: { sources: string[] }) {
  return (
    <LayoutStack as="ul" gap="xs">
      {[...new Set(sources)].map((source) => (
        <Text key={source} as="li" font="mono" size="xs" wrap="anywhere">
          {source}
        </Text>
      ))}
    </LayoutStack>
  );
}

function ViewportReviewPlan({ idPrefix }: { idPrefix: string }) {
  return (
    <LayoutStack as="section" gap="sm" aria-label="Viewport review plan">
      <Heading level={3} id={`${idPrefix}-viewport-review`}>
        Mobile, tablet and desktop review
      </Heading>
      <Text size="sm" tone="secondary">
        These dimensions are review fixtures. Core Layout owns actual breakpoints. Inspect the same View through toolbar
        light/dark and Korean/English settings. A checklist is not a completed review.
      </Text>
      <LayoutGrid columns={{ base: 1, md: 3 }} gap="sm">
        {pageViewportChecks.map((viewport) => (
          <SectionCard key={viewport.name} appearance="muted" padding="sm">
            <LayoutStack gap="xs">
              <Heading level={4}>{viewport.name}</Heading>
              <Text size="sm">{viewport.checks}</Text>
              <Text size="xs" tone="secondary">
                Browser result: not recorded in this document
              </Text>
            </LayoutStack>
          </SectionCard>
        ))}
      </LayoutGrid>
    </LayoutStack>
  );
}

function PreviewContract({ preview, idPrefix }: { preview: PagePreviewDocumentation; idPrefix: string }) {
  const groups = previewStateGroups(preview);
  const contract = preview.contract;
  return (
    <SectionCard withBorder padding="md">
      <LayoutStack gap="md">
        <LayoutStack gap="xs">
          <Heading level={3} id={idPrefix}>
            {preview.storyTitle}
          </Heading>
          <Text size="sm" tone="secondary">
            {preview.branch === 'edit'
              ? `Editor branch · ${preview.query ?? 'edit=true'}`
              : 'Default or conditional display branch'}
          </Text>
        </LayoutStack>
        {contract ? (
          <LayoutStack gap="sm">
            <Text weight="strong">{contract.purpose}</Text>
            <Text size="sm">{contract.scenario}</Text>
          </LayoutStack>
        ) : (
          <Alert tone="warning" role="note">
            Task specification is missing. Only a source mapping is present.
          </Alert>
        )}
        <LayoutInline gap="action-group" wrap="wrap">
          <StorybookLink href={`/?path=/story/${preview.storyId}`}>{`Open ${preview.variant} story`}</StorybookLink>
          <StorybookLink href={`/?path=/docs/${preview.storyId.split('--')[0]}--documentation`}>
            Page group docs
          </StorybookLink>
        </LayoutInline>
        <LayoutStack gap="xs">
          <Heading level={4}>Implementation and fixture owners</Heading>
          <Text size="xs" tone="secondary">
            Generated import and JSX mapping. Owners are associated with this story source; this is not evidence that
            the full server route ran.
          </Text>
          <SourceList sources={[preview.storySource, ...preview.owners]} />
          <Text size="sm">
            The story file and its fixture imports own data, callbacks and transport bindings. Reproduce a state there
            without copying the production View.
          </Text>
        </LayoutStack>
        <LayoutStack gap="xs">
          <Heading level={4}>Local behavior and excluded scope</Heading>
          <Text size="xs" tone="secondary">
            Scope recorded in the source mapping. This describes implementation boundaries, not a passing result.
          </Text>
          <Text size="sm" lang="en">
            {preview.scope}
          </Text>
        </LayoutStack>
        <LayoutStack gap="xs">
          <Heading level={4}>Selected branch examples</Heading>
          <StateLinks states={groups.focused} />
          <Text size="xs" tone="secondary">
            These are mapped CSF exports, not execution results, accessibility certification or completed server
            operations.
          </Text>
          {groups.related.length ? (
            <Disclosure label="Other branches and states in this story file">
              <LayoutStack gap="sm">
                <Text size="xs" tone="secondary">
                  These examples share a file across routes. Stories such as Phone use their own default args; do not
                  assume they represent the selected route branch.
                </Text>
                <StateLinks states={groups.related} />
              </LayoutStack>
            </Disclosure>
          ) : null}
        </LayoutStack>
        {contract ? (
          <LayoutStack gap="xs">
            <Heading level={4}>Task review criteria</Heading>
            <LayoutStack as="ul" gap="xs">
              {pageReviewChecks[contract.pattern].map((check) => (
                <Text key={check} as="li" size="sm">
                  {check}
                </Text>
              ))}
            </LayoutStack>
          </LayoutStack>
        ) : null}
      </LayoutStack>
    </SectionCard>
  );
}

function PageRecordDetails({ record, idPrefix }: { record: PageDocumentationRecord; idPrefix: string }) {
  const sourcePrefix = `${idPrefix}-source-${headingIdentity(record.file)}`;
  return (
    <LayoutStack as="section" gap="md" aria-label={record.file}>
      <LayoutStack gap="xs">
        <Heading level={2} id={sourcePrefix} scale={{ base: 4, sm: 3 }} wrap="anywhere">
          {record.route} · {record.kind}
        </Heading>
        <Text size="sm">
          {dispositionLabels[record.disposition] ? dispositionLabels[record.disposition] : record.disposition}
        </Text>
        <Text font="mono" size="xs" wrap="anywhere">
          {record.file}
        </Text>
        <Text font="mono" size="xs" tone="secondary" wrap="anywhere">
          SHA-256 {record.sha256}
        </Text>
      </LayoutStack>
      <DataTableView
        accessibleLabel="Page review evidence"
        emptyMessage="No review evidence recorded"
        desktopMinWidth="100%"
        rows={[
          { key: 'source', label: 'Source mapping', status: record.reviewStatus },
          {
            key: 'states',
            label: 'Fixture states',
            status: 'CSF example existence is recorded below',
          },
          {
            key: 'browser',
            label: 'Browser review',
            status: 'No result recorded in this catalog',
          },
          {
            key: 'service',
            label: 'Server, permission and SSR',
            status: 'Outside fixture scope; separate verification required',
          },
          {
            key: 'at',
            label: 'VoiceOver and Orca',
            status: 'No execution evidence recorded in this catalog',
          },
        ]}
        getRowKey={(row) => row.key}
        columns={[
          { key: 'label', header: 'Evidence', renderCell: (row) => row.label },
          {
            key: 'status',
            header: 'Recorded status',
            renderCell: (row) => (
              <Text size="sm" wrap="anywhere">
                {row.status}
              </Text>
            ),
          },
        ]}
      />
      {record.inheritedTerminalLayouts.length ? (
        <Alert tone="warning" role="note">
          <LayoutStack gap="xs">
            <Text size="sm">
              A parent layout terminates this route. A View story does not establish that the production route is
              reachable.
            </Text>
            <SourceList sources={record.inheritedTerminalLayouts} />
          </LayoutStack>
        </Alert>
      ) : null}
      {record.previews.length ? (
        record.previews.map((preview) => (
          <PreviewContract
            key={`${preview.storyId}:${preview.branch ?? ''}`}
            preview={preview}
            idPrefix={`${sourcePrefix}-preview-${headingIdentity(preview.storyId)}-branch-${preview.branch === undefined ? 'none' : `value-${headingIdentity(preview.branch)}`}`}
          />
        ))
      ) : (
        <Alert tone="neutral" role="note">
          No independent page View story is mapped to this entry. Inspect redirect, notFound, development or provider
          disposition and source below.
        </Alert>
      )}
      <Disclosure label="Route branches, parent shells and boundaries">
        <LayoutStack gap="sm">
          <Text size="xs" tone="secondary">
            {'Direct JSX: '}
            {record.directJsx.join(', ') || '—'}
          </Text>
          <SourceList sources={record.inheritedBoundaries} />
          {record.redirects.map((redirect) => (
            <Text key={`${redirect.line}:${redirect.expression}`} font="mono" size="xs" wrap="anywhere">
              {record.file}:{redirect.line} · {redirect.expression}
            </Text>
          ))}
          <Text size="xs" tone="secondary">
            This lists source branches. Request handling, redirects, boundary activation and shell composition require
            application verification.
          </Text>
        </LayoutStack>
      </Disclosure>
      <ViewportReviewPlan idPrefix={sourcePrefix} />
    </LayoutStack>
  );
}

/** Reused by global DocsPage. Relies on the existing preview locale/theme providers. */
export function PageContractDocumentation({ title }: { title: string }) {
  const idPrefix = `page-contract-${headingIdentity(title)}`;
  const records = getPageDocumentation(title);
  const [source, setSource] = useState('');
  const selected = records.find((record) => record.file === source) ?? records[0];
  if (!selected) {
    return (
      <Alert tone="warning" role="note">
        This group has no route or View contract mapped in the catalog.
      </Alert>
    );
  }
  return (
    <LayoutStack gap="md" lang="en">
      <Heading level={2} id={idPrefix}>
        Page contract
      </Heading>
      {records.length > 1 ? (
        <Select
          label="Choose a route sharing this View"
          value={selected.file}
          searchable
          data={records.map((record) => ({
            value: record.file,
            label: `${record.route} · ${record.kind} · ${record.family}`,
          }))}
          onChange={(value) => setSource(value ?? '')}
        />
      ) : null}
      <PageRecordDetails record={selected} idPrefix={idPrefix} />
    </LayoutStack>
  );
}

export function PageDocumentationBrowser({ initialRoute = '/login' }: { initialRoute?: string }) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState(
    pageDocumentation.find((record) => record.kind === 'page' && record.route === initialRoute)?.file ??
      pageDocumentation[0]?.file ??
      '',
  );
  const normalized = query.trim().toLowerCase();
  const visible = pageDocumentation.filter((record) =>
    `${record.route} ${record.file} ${record.family} ${record.kind} ${record.previews.map((preview) => preview.storyTitle).join(' ')}`
      .toLowerCase()
      .includes(normalized),
  );
  const selected = visible.find((record) => record.file === source) ?? visible[0];
  const pages = pageDocumentation.filter((record) => record.kind === 'page');
  return (
    <LayoutContainer size="wide" inset="md" lang="en">
      <LayoutStack gap="section">
        <LayoutStack gap="sm">
          <Heading level={1} scale={{ base: 3, sm: 2 }}>
            Page documentation
          </Heading>
          <Text>Review user task → production View → fixture states → local behavior and limits → running story.</Text>
          <Text size="sm" tone="secondary">
            {`${pageDocumentation.length} visual entries · ${pages.length} page sources. Source and View mapping counts are not passing browser, design or accessibility results.`}
          </Text>
          <Text font="mono" size="xs" tone="secondary" wrap="anywhere">
            Source manifest SHA-256 {pageSourceManifestHash}
          </Text>
        </LayoutStack>
        <LayoutGrid columns={{ base: 1, md: 2 }} gap="sm">
          <TextInput
            label="Search route, task group or source"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="For example: /forms, Translation, layout"
          />
          <Select
            label="Select a page contract"
            searchable
            value={selected?.file ?? null}
            data={visible.map((record) => ({
              value: record.file,
              label: `${record.route} · ${record.kind} · ${record.family}`,
            }))}
            onChange={(value) => setSource(value ?? '')}
            nothingFoundMessage="No matching entry."
          />
        </LayoutGrid>
        {selected ? (
          <PageRecordDetails key={selected.file} record={selected} idPrefix="page-browser" />
        ) : (
          <Alert tone="neutral" role="status">
            No source matches the search.
          </Alert>
        )}
      </LayoutStack>
    </LayoutContainer>
  );
}
