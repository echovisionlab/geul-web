import { useContext, useState } from 'react';
import { Canvas, Controls, Description, DocsContext, Title, useOf } from '@storybook/addon-docs/blocks';
import { representativeStory } from './documentation-contract';
import { PageContractDocumentation } from '../stories/design-system/pages/PageDocumentation';
import componentRegistry from '../stories/design-system/components/component-docs.generated.json';
import { Disclosure } from '../components/core/Disclosure';
import { ScrollArea } from '../components/core/Display';
import { StorybookLink } from '../stories/shared/StorybookLink';
import { handbookDocumentId } from '../stories/design-system/handbook-navigation';
import classes from './DesignSystemDocs.module.css';

interface ComponentDocumentation {
  title: string;
  sourceFiles: string[];
  summary: string;
  api: Array<{ name: string; type: string; required: boolean; description?: string; defaultValue?: string }>;
  stateStories: Array<{ id: string; name: string }>;
  usage: string[];
  accessibility: string[];
  constraints: string[];
  relatedDocs: string[];
  anatomy?: string[];
  tokenReferences?: Array<{
    name: string;
    registered: boolean;
    sources: Array<{ file: string; line: number; property?: string }>;
    definitions: Array<{ file: string; line: number; value: string; context: string }>;
  }>;
  styleSources?: Array<{ file: string; importedBy: string[] }>;
  computedTokenReferences?: Array<{ file: string; line: number; expression?: string }>;
  tokenReferenceLimitations?: string[];
}

// Docs can remount when toolbar globals change. Keep this view preference in
// Storybook memory only; another document starts closed and explicit close wins.
const openLivePreviewTitles = new Set<string>();

function TokenReferences({ component }: { component: ComponentDocumentation }) {
  const [opened, setOpened] = useState(false);
  const tokens = component.tokenReferences ?? [];
  return (
    <section>
      <h2 id="token-references">Token references</h2>
      <p>
        Static references read from the owning source and its direct CSS imports. This is not a runtime list of applied
        tokens.
      </p>
      <StorybookLink href="/?path=/story/foundations-tokens--reference">Token roles, values and themes</StorybookLink>
      <Disclosure
        label={`Source token references (${tokens.length})`}
        opened={opened}
        onChange={setOpened}
        keepMounted={false}
      >
        {tokens.length ? (
          <div className={classes.tableScroll}>
            <ScrollArea role="region" aria-label="Source token reference table" scrollbars="x">
              <table>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Source reference</th>
                    <th>Canonical definition and condition</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <tr key={token.name}>
                      <td>
                        <code>{token.name}</code>
                        {!token.registered ? <p>No canonical declaration</p> : null}
                      </td>
                      <td>
                        {token.sources.map((source) => (
                          <p key={`${source.file}:${source.line}:${source.property}`}>
                            <code>
                              {source.file}:{source.line}
                            </code>
                            {source.property ? (
                              <>
                                <br />
                                <code>{source.property}</code>
                              </>
                            ) : null}
                          </p>
                        ))}
                      </td>
                      <td>
                        {token.definitions.map((definition) => (
                          <p key={`${definition.file}:${definition.line}`}>
                            <code>{definition.value}</code>
                            <br />
                            <code>{definition.context}</code>
                            <br />
                            <code>
                              {definition.file}:{definition.line}
                            </code>
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        ) : (
          <p>No static reference was found in this direct scope. Internal components may still consume tokens.</p>
        )}
        {component.styleSources?.length ? (
          <p>
            Style source files:{' '}
            {component.styleSources.map((source) => (
              <code key={source.file}>{source.file} </code>
            ))}
          </p>
        ) : null}
        {component.computedTokenReferences?.length ? (
          <p>
            Locations of unresolved computed names:{' '}
            {component.computedTokenReferences.map((source) => (
              <code key={`${source.file}:${source.line}`}>
                {source.file}:{source.line}{' '}
              </code>
            ))}
          </p>
        ) : null}
        <ul>
          {component.tokenReferenceLimitations?.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </Disclosure>
    </section>
  );
}

function Guidance({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null;
  }
  return (
    <section>
      <h2 id={title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function ForbiddenProperties({ names }: { names: string[] }) {
  const [opened, setOpened] = useState(false);
  if (!names.length) {
    return null;
  }
  return (
    <Disclosure label={`Unsupported properties (${names.length})`} opened={opened} onChange={setOpened}>
      <p>These properties are closed with never in the public type. They are not supported API.</p>
      <p>
        {names.map((name) => (
          <code key={name}>{name} </code>
        ))}
      </p>
    </Disclosure>
  );
}

function isConsumerSource(item: string) {
  return /^(?:Consumer|사용처): /.test(item);
}

function ConsumerSources({ items }: { items: string[] }) {
  const [opened, setOpened] = useState(false);
  if (!items.length) {
    return null;
  }
  return (
    <Disclosure label={`Production consumers (${items.length})`} opened={opened} onChange={setOpened}>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <code>{item.replace(/^(?:Consumer|사용처): /, '')}</code>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

/** The documentation shares source-derived contracts and mounts one real preview on demand. */
export function DesignSystemDocs() {
  const { preparedMeta } = useOf('meta', ['meta']);
  const context = useContext(DocsContext);
  const title = preparedMeta.title;
  const [previewState, setPreviewState] = useState(() => ({ title, opened: openLivePreviewTitles.has(title) }));
  const previewOpen = previewState.title === title ? previewState.opened : openLivePreviewTitles.has(title);
  const setPreviewOpen = (opened: boolean) => {
    if (opened) {
      openLivePreviewTitles.add(title);
    } else {
      openLivePreviewTitles.delete(title);
    }
    setPreviewState({ title, opened });
  };
  const component = (componentRegistry.components as ComponentDocumentation[]).find(
    (entry) => entry.title === preparedMeta.title,
  );
  const stories = context.componentStories();
  const example = representativeStory(stories);
  const supportedApi = component?.api.filter((prop) => prop.type !== 'never') ?? [];
  const forbiddenApi = component?.api.filter((prop) => prop.type === 'never').map((prop) => prop.name) ?? [];
  return (
    <div className={classes.guide} lang="en" dir="ltr">
      <Title />
      {!component ? <Description /> : null}
      {component ? <p>{component.summary}</p> : null}
      {example ? (
        <section>
          <h2 id="representative-example">Representative example · {example.name}</h2>
          <p>A real example from the current CSF. Expand it to run the same Core or View with interactive Controls.</p>
          <Disclosure
            label="Open live example and Controls"
            opened={previewOpen}
            onChange={setPreviewOpen}
            keepMounted={false}
          >
            {previewOpen ? (
              <>
                <Canvas of={example.moduleExport} withToolbar />
                <div className={classes.tableScroll}>
                  <ScrollArea role="region" aria-label="Live example Controls" scrollbars="x">
                    <Controls of={example.moduleExport} />
                  </ScrollArea>
                </div>
              </>
            ) : null}
          </Disclosure>
        </section>
      ) : null}
      {component ? (
        <>
          <p>
            Owning source:{' '}
            {component.sourceFiles.map((file) => (
              <code key={file}>{file} </code>
            ))}
          </p>
          <Guidance title="Anatomy" items={component.anatomy ?? []} />
          <Guidance title="Usage" items={component.usage.filter((item) => !isConsumerSource(item))} />
          <ConsumerSources items={component.usage.filter((item) => isConsumerSource(item))} />
          <h2 id="public-api">Public API</h2>
          <p>
            Read from the public source types. Required properties and defaults may depend on the type branch or parent
            context. Only defaults found in the implementation are shown.
          </p>
          {supportedApi.length ? (
            <div className={classes.tableScroll}>
              <ScrollArea role="region" aria-label="Public API table" scrollbars="x">
                <table className={classes.apiTable}>
                  <thead>
                    <tr>
                      <th>Prop</th>
                      <th>Type</th>
                      <th>Required</th>
                      <th>Default</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supportedApi.map((prop, index) => (
                      <tr key={`${prop.name}-${index}`}>
                        <td>
                          <code>{prop.name}</code>
                        </td>
                        <td>
                          <code>{prop.type}</code>
                        </td>
                        <td>{prop.required ? 'Required' : 'Branch-dependent / optional'}</td>
                        <td>
                          <code>{prop.defaultValue ?? '—'}</code>
                        </td>
                        <td>{prop.description ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          ) : (
            <p>For this composition, read the linked Core documentation and owning types.</p>
          )}
          <ForbiddenProperties names={forbiddenApi} />
          <Guidance title="Accessibility and interaction" items={component.accessibility} />
          <TokenReferences component={component} />
          <Guidance title="Constraints and review scope" items={component.constraints} />
          {component.relatedDocs.length ? (
            <section>
              <h2 id="related-specifications">Related specifications</h2>
              <ul>
                {component.title.startsWith('Core/Actions/') ? (
                  <li>
                    <StorybookLink href="/?path=/story/design-system-usage-rules--action-emphasis">
                      Correct and incorrect emphasis for ordinary actions
                    </StorybookLink>
                  </li>
                ) : null}
                {component.relatedDocs.map((file) => (
                  <li key={file}>
                    <StorybookLink
                      href={`/?path=/story/design-system-handbook--reference&args=initialDocument:${handbookDocumentId(file)}`}
                    >
                      {file}
                    </StorybookLink>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
      {preparedMeta.title.startsWith('Pages/') ? (
        <section>
          <PageContractDocumentation title={preparedMeta.title} />
        </section>
      ) : null}
      <section>
        <h2 id="states-and-examples">States and examples</h2>
        <p>
          These examples run the actual Core and page Views. Use the Theme, Language and Viewport toolbar to change
          review conditions. Reproducible examples do not imply design approval or completed assistive-technology
          validation.
        </p>
        <ul>
          {stories.map((story) => (
            <li key={story.id}>
              <StorybookLink href={`/?path=/story/${story.id}`}>{story.name}</StorybookLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
