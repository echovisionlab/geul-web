import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NativeSelect, TextInput } from '@/components/core/Input';
import { LayoutStack } from '@/components/core/Layout';
import { TextButton } from '@/components/core/TextButton';
import { Text } from '@/components/core/Typography';
import handbook from './handbook.generated.json';
import { PreviewFrame } from '../shared/PreviewFrame';
import { StorybookLink } from '../shared/StorybookLink';
import { handbookDocumentId, handbookTarget, headingAnchors } from './handbook-navigation';
import classes from './Handbook.module.css';

export function Handbook({ initialDocument = 'docs/design-system.md' }: { initialDocument?: string }) {
  const [selectedPath, setSelectedPath] = useState(
    () =>
      handbook.documents.find(
        (document) => document.path === initialDocument || handbookDocumentId(document.path) === initialDocument,
      )?.path ?? handbook.documents[0].path,
  );
  const [query, setQuery] = useState('');
  const [pendingAnchor, setPendingAnchor] = useState('');
  const articleRef = useRef<HTMLElement>(null);
  const selected = handbook.documents.find((document) => document.path === selectedPath) ?? handbook.documents[0];
  const filtered = handbook.documents.filter((document) =>
    `${document.title} ${document.path} ${document.markdown}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const options = filtered.some((document) => document.path === selected.path) ? filtered : [selected, ...filtered];
  useEffect(() => {
    if (pendingAnchor) {
      const heading = articleRef.current?.ownerDocument.getElementById(decodeURIComponent(pendingAnchor.slice(1)));
      heading?.scrollIntoView();
      heading?.focus({ preventScroll: true });
      setPendingAnchor('');
    }
  }, [selected.path, pendingAnchor]);
  return (
    <PreviewFrame
      wide
      title="Geul · Design system handbook"
      description="Read the source specifications in Storybook. Each document records implementation ownership, usage, API decisions and verification scope."
    >
      <div lang="en" dir="ltr">
        <LayoutStack gap="lg">
          <TextInput
            label="Search documentation"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <NativeSelect
            label="Specification"
            value={selected.path}
            data={options.map((document) => ({ value: document.path, label: document.title }))}
            onChange={(event) => setSelectedPath(event.currentTarget.value)}
          />
          <Text size="xs" tone="secondary">
            {selected.path} · {filtered.length} / {handbook.documents.length}
          </Text>
          <article ref={articleRef} className={classes.document} aria-label={selected.title} lang={selected.language}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, headingAnchors]}
              components={{
                table: ({ children }) => (
                  <div className={classes.tableScroll}>
                    <table>{children}</table>
                  </div>
                ),
                a: ({ href, children }) => {
                  if (href?.startsWith('#')) {
                    return (
                      <a
                        href={href}
                        onClick={(event) => {
                          event.preventDefault();
                          const heading = event.currentTarget.ownerDocument.getElementById(
                            decodeURIComponent(href.slice(1)),
                          );
                          heading?.scrollIntoView();
                          heading?.focus({ preventScroll: true });
                        }}
                      >
                        {children}
                      </a>
                    );
                  }
                  if (!href || /^(https?:|mailto:)/.test(href)) {
                    return <a href={href}>{children}</a>;
                  }
                  if (href.startsWith('/?path=') || href.startsWith('?path=')) {
                    return <StorybookLink href={href}>{children}</StorybookLink>;
                  }
                  const target = handbookTarget(href, selected.path);
                  if (handbook.documents.some((document) => document.path === target.path)) {
                    return (
                      <TextButton
                        appearance="accent"
                        onClick={() => {
                          setSelectedPath(target.path);
                          setPendingAnchor(target.hash);
                        }}
                      >
                        {children}
                      </TextButton>
                    );
                  }
                  if (target.path.startsWith('docs/')) {
                    return <a href={`/ui-kit-docs/${target.path.slice('docs/'.length)}${target.hash}`}>{children}</a>;
                  }
                  if (target.path.startsWith('design/storybook/')) {
                    return (
                      <a href={`/design-system-review/${target.path.slice('design/storybook/'.length)}${target.hash}`}>
                        {children}
                      </a>
                    );
                  }
                  return <span title={target.path}>{children}</span>;
                },
              }}
            >
              {selected.markdown}
            </ReactMarkdown>
          </article>
        </LayoutStack>
      </div>
    </PreviewFrame>
  );
}
