import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Heading, Text } from '../Typography';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { withFeatureLabels } from '@/stories/feature-localization';
import { TableOfContentsView, type TocItem } from './TableOfContentsView';

function DocumentArticle({ items }: { items: TocItem[] }) {
  return (
    <article style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      {items.map((item) => (
        <section key={item.id} style={{ minHeight: '80vh' }}>
          <Heading id={item.id} level={item.level as 1 | 2 | 3 | 4 | 5 | 6}>
            {item.label}
          </Heading>
          <Text>{item.label} content</Text>
        </section>
      ))}
    </article>
  );
}

const longDocumentItems: TocItem[] = Array.from({ length: 60 }, (_, index) => ({
  id: `long-section-${index + 1}`,
  label: `Section ${index + 1}`,
  level: index % 2 === 0 ? 2 : 3,
}));

/** Five authored levels and titles long enough to wrap and clamp (skipped levels: unit tests). */
const deepNestingItems: TocItem[] = [
  { id: 'deep-introduction', label: 'Introduction', level: 2 },
  { id: 'deep-scope', label: 'Scope', level: 3 },
  {
    id: 'deep-terms',
    label: 'Terms used throughout this document, including several that need a longer explanation',
    level: 4,
  },
  { id: 'deep-audio-terms', label: 'Audio terms', level: 5 },
  { id: 'deep-sample-rate', label: 'Sample rate and bit depth conventions', level: 6 },
  { id: 'deep-method', label: 'Method', level: 2 },
  { id: 'deep-overview', label: 'Overview of the method and its constraints', level: 3 },
  { id: 'deep-capture', label: 'Capture', level: 3 },
  { id: 'deep-room', label: 'Room', level: 4 },
  { id: 'deep-room-tone', label: 'Room tone', level: 5 },
  {
    id: 'deep-results',
    label:
      'Results, with an exceptionally long section title that keeps going so that it must wrap onto several lines and finally clamp in the outline instead of growing without bound',
    level: 2,
  },
  { id: 'deep-summary', label: 'Summary', level: 3 },
  { id: 'deep-appendix', label: 'Appendix', level: 2 },
];

const meta: Meta<typeof TableOfContentsView> = {
  title: 'Core/Navigation/TableOfContents',
  component: TableOfContentsView,
  parameters: { layout: 'fullscreen' },
  decorators: [withFeatureLabels({ project: (_args, translate) => ({ title: translate('tableOfContents.title') }) })],
  // The outline always reserves its space at the inline end of the document it navigates (the
  // production composition); the document starts at the start edge.
  render: (args) => (
    <TableOfContentsView {...args}>
      <DocumentArticle items={args.items} />
    </TableOfContentsView>
  ),
  args: {
    title: 'Table of Contents',
    children: null,
    items: [
      { id: 'overview', label: 'Overview', level: 2 },
      { id: 'principles', label: 'Principles', level: 2 },
      { id: 'details', label: 'Details', level: 3 },
      { id: 'examples', label: 'Examples', level: 3 },
      { id: 'summary', label: 'Summary', level: 2 },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof TableOfContentsView>;

/** The persistent column is the wide-screen (lg, 75em) presentation; the rail is used below it. */
function isWide() {
  return window.innerWidth >= 1200;
}

function outlineParts(canvasElement: HTMLElement) {
  const navigation = canvasElement.querySelector<HTMLElement>('[role="navigation"]')!;
  const link = (id: string) => navigation.querySelector<HTMLAnchorElement>(`a[href="#${id}"][data-toc-index]`)!;
  return { navigation, link };
}

async function readHeading(canvasElement: HTMLElement, id: string) {
  // Instant document scroll (the active line is 100px below the viewport top), then the
  // throttled scroll spy updates the current entry.
  const heading = canvasElement.ownerDocument.getElementById(id)!;
  window.scrollTo({ top: window.scrollY + heading.getBoundingClientRect().top - 40, behavior: 'instant' });
  window.dispatchEvent(new Event('scroll'));
  return heading;
}

// Review examples are left at their initial state for manual mouse inspection.
export const Default: Story = { tags: ['a11y-core-structure'] };

export const LongDocument: Story = { args: { items: longDocumentItems } };

export const ManyTopLevelSections: Story = {
  args: {
    items: Array.from({ length: 120 }, (_, index) => ({
      id: `long-section-${index + 1}`,
      label: `Section ${index + 1}`,
      level: 2,
    })),
  },
};

export const LongLabels: Story = {
  args: {
    items: [
      { id: 'purpose', label: 'Purpose and scope of the document', level: 2 },
      { id: 'context', label: 'A long heading that wraps while preserving the complete destination name', level: 3 },
      { id: 'nested', label: 'Nested details in a deeper subsection', level: 4 },
      { id: 'rules', label: 'Usage rules and examples', level: 2 },
      { id: 'end', label: 'Summary and further reading', level: 2 },
    ],
  },
};

/** The outline stays inside the document box: it stops at the document end, above the page footer. */
export const FooterBoundary: Story = {
  ...LongDocument,
  render: (args) => (
    <>
      <TableOfContentsView {...args}>
        <DocumentArticle items={args.items} />
      </TableOfContentsView>
      <footer style={{ minHeight: 180, padding: 24 }}>
        <Text>End of document</Text>
      </footer>
    </>
  ),
};

/**
 * Wide screens (lg and up) with a reserved layout: a persistent outline column beside the
 * reading column. The ink marker follows the current section; a long outline keeps it in view.
 */
export const ReadingColumn: Story = {
  args: { items: longDocumentItems },
  tags: ['a11y-core-structure'],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[role="navigation"]')).not.toBeNull());
    const { navigation, link } = outlineParts(canvasElement);
    if (!isWide()) {
      // Below lg the same reserved layout presents the rail; ScrubNavigation covers it.
      await expect(navigation).toHaveAttribute('data-presentation', 'rail');
      return;
    }
    await expect(navigation).toHaveAttribute('data-presentation', 'column');
    await expect(navigation.querySelector('[aria-expanded]')).toBeNull();
    const labelId = navigation.getAttribute('aria-labelledby')!;
    await expect(canvasElement.ownerDocument.getElementById(labelId)).toBeVisible();
    const list = navigation.querySelector('ol')!;
    await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    await readHeading(canvasElement, 'long-section-42');
    const current = link('long-section-42');
    await waitFor(() => expect(current).toHaveAttribute('aria-current', 'location'));
    await expect(link('long-section-41')).toHaveAttribute('data-ancestor');
    await waitFor(() => {
      const listBounds = list.getBoundingClientRect();
      const bounds = current.getBoundingClientRect();
      expect(bounds.top).toBeGreaterThanOrEqual(listBounds.top - 1);
      expect(bounds.bottom).toBeLessThanOrEqual(listBounds.bottom + 1);
    });
    const marker = list.querySelector<HTMLElement>('li[aria-hidden="true"]')!;
    await waitFor(() =>
      expect(Math.abs(marker.getBoundingClientRect().top - current.getBoundingClientRect().top)).toBeLessThan(2),
    );
    await readHeading(canvasElement, 'long-section-5');
    await waitFor(() => expect(link('long-section-5')).toHaveAttribute('aria-current', 'location'));
    await waitFor(() =>
      expect(
        Math.abs(marker.getBoundingClientRect().top - link('long-section-5').getBoundingClientRect().top),
      ).toBeLessThan(2),
    );
    window.scrollTo({ top: 0, behavior: 'instant' });
  },
};

/** Medium widths (sm–lg): the quiet rail sits in the reserved margin and never covers text. */
export const MediumRail: Story = {
  args: { items: longDocumentItems },
  globals: { viewport: { value: 'tablet', isRotated: false } },
};

/** Phones: the same rail with a 44px coarse-pointer target in reserved inline-end space; press and drag to scrub. */
export const PhoneRail: Story = {
  args: { items: longDocumentItems },
  globals: { viewport: { value: 'phone', isRotated: false } },
};

/** h2 → h6 with long titles: one md indent per level, capped at three visual levels; parents stay in ink. */
export const DeepNesting: Story = {
  args: { items: deepNestingItems },
  tags: ['a11y-core-structure'],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-toc-index]')).not.toBeNull());
    const { link } = outlineParts(canvasElement);
    const depth = (id: string) => link(id).style.getPropertyValue('--_toc-depth');
    await expect(depth('deep-introduction')).toBe('0');
    await expect(depth('deep-scope')).toBe('1');
    await expect(depth('deep-terms')).toBe('2');
    // Deeper levels stay on the last visual step instead of drifting.
    await expect(depth('deep-sample-rate')).toBe('2');
    await expect(depth('deep-overview')).toBe('1');
    // Real nested list structure: Room tone → Room → Capture → Method.
    const parentLink = (id: string) => link(id).closest('ol')!.closest('li')!.querySelector(':scope > a');
    await expect(parentLink('deep-room-tone')).toBe(link('deep-room'));
    await expect(parentLink('deep-room')).toBe(link('deep-capture'));
    await expect(parentLink('deep-capture')).toBe(link('deep-method'));
    await readHeading(canvasElement, 'deep-room-tone');
    await waitFor(() => expect(link('deep-room-tone')).toHaveAttribute('aria-current', 'location'));
    for (const id of ['deep-room', 'deep-capture', 'deep-method']) {
      await expect(link(id)).toHaveAttribute('data-ancestor');
    }
    await expect(link('deep-introduction')).not.toHaveAttribute('data-ancestor');
    window.scrollTo({ top: 0, behavior: 'instant' });
  },
};

/**
 * Press–drag–release on the rail (touch shown; a mouse drag behaves the same): the heading under the
 * pointer is highlighted in the open outline, release navigates, moving far sideways cancels.
 */
export const ScrubNavigation: Story = {
  args: { items: longDocumentItems },
  tags: ['a11y-core-structure'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = await canvas.findByRole('navigation');
    if (isWide()) {
      // Scrubbing belongs to the rail (below lg); wide screens show the persistent column.
      await expect(navigation).toHaveAttribute('data-presentation', 'column');
      return;
    }
    const rail = navigation.querySelector<HTMLAnchorElement>('a[aria-expanded]')!;
    const marks = rail.firstElementChild as HTMLElement;
    const box = () => marks.getBoundingClientRect();
    const x = rail.getBoundingClientRect().left + rail.getBoundingClientRect().width / 2;
    const pointer = (type: string, clientX: number, clientY: number) =>
      rail.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          clientX,
          clientY,
        }),
      );
    pointer('pointerdown', x, box().top);
    await waitFor(() => expect(rail).toHaveAttribute('aria-expanded', 'true'));
    await waitFor(() =>
      expect(navigation.querySelector('[data-scrub-target]')).toHaveAttribute('href', '#long-section-1'),
    );
    pointer('pointermove', x, box().top + box().height * 0.5);
    const middle = `#long-section-${Math.round(0.5 * 59) + 1}`;
    await waitFor(() => expect(navigation.querySelector('[data-scrub-target]')).toHaveAttribute('href', middle));
    // The outline follows the finger: the highlighted entry is visible in the bounded list.
    const list = navigation.querySelector('ol')!;
    const target = navigation.querySelector<HTMLAnchorElement>('[data-scrub-target]')!;
    await expect(target.getBoundingClientRect().top).toBeGreaterThanOrEqual(list.getBoundingClientRect().top - 1);
    await expect(target.getBoundingClientRect().bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom + 1);
    // Scrubbing previews only; the reading location and its announcement do not change.
    await expect(target).not.toHaveAttribute('aria-current');
    pointer('pointermove', x, box().top + box().height);
    await waitFor(() =>
      expect(navigation.querySelector('[data-scrub-target]')).toHaveAttribute('href', '#long-section-60'),
    );
    pointer('pointerup', x, box().top + box().height);
    await waitFor(() => expect(canvas.getByRole('heading', { name: 'Section 60' })).toHaveFocus());
    await expect(navigation.querySelector('[data-scrub-target]')).toBeNull();
    await waitFor(() => expect(rail).toHaveAttribute('aria-expanded', 'false'));

    // Cancel: press, move far sideways and release — the document does not move.
    const focused = canvasElement.ownerDocument.activeElement;
    pointer('pointerdown', x, box().top + box().height * 0.25);
    await waitFor(() => expect(navigation.querySelector('[data-scrub-target]')).not.toBeNull());
    pointer('pointermove', x - 400, box().top + box().height * 0.25);
    await waitFor(() => expect(navigation.querySelector('[data-scrub-target]')).toBeNull());
    pointer('pointerup', x - 400, box().top + box().height * 0.25);
    await expect(canvasElement.ownerDocument.activeElement).toBe(focused);
    window.scrollTo({ top: 0, behavior: 'instant' });
  },
};

export const KeyboardNavigation: Story = {
  tags: ['a11y-core-structure'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = await canvas.findByRole('navigation');
    // The outline precedes the document in reading and focus order in every presentation.
    const article = canvasElement.querySelector('article')!;
    await expect(navigation.compareDocumentPosition(article) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    if (isWide()) {
      // Column: ordinary links in document order; Enter moves focus to the heading.
      await expect(navigation).toHaveAttribute('data-presentation', 'column');
      await expect(navigation.querySelector('[aria-expanded]')).toBeNull();
      const firstName = canvasElement.querySelector('#overview')!.textContent!;
      within(navigation).getByRole('link', { name: firstName }).focus();
      await userEvent.keyboard('{Tab}{Enter}');
      const selectedName = canvasElement.querySelector('#principles')!.textContent!;
      const heading = canvas.getByRole('heading', { name: selectedName });
      await expect(heading).toHaveFocus();
      await expect(heading).toHaveAttribute('tabindex', '-1');
      await waitFor(() =>
        expect(within(navigation).getByRole('link', { name: selectedName })).toHaveAttribute(
          'aria-current',
          'location',
        ),
      );
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    const rail = within(navigation).getByRole('link', { name: navigation.getAttribute('aria-label')! });
    rail.focus();
    await waitFor(() => expect(rail).toHaveAttribute('aria-expanded', 'true'));
    await userEvent.keyboard('{ArrowDown}');
    const firstName = canvasElement.querySelector('#overview')!.textContent!;
    const first = within(navigation).getByRole('link', { name: firstName });
    await expect(first).toHaveFocus();
    await userEvent.keyboard('{Tab}{Enter}');
    const selectedName = canvasElement.querySelector('#principles')!.textContent!;
    const heading = canvas.getByRole('heading', { name: selectedName });
    await expect(heading).toHaveFocus();
    await expect(heading).toHaveAttribute('tabindex', '-1');
    await expect(rail).toHaveAttribute('aria-expanded', 'false');
    rail.focus();
    await waitFor(() => expect(rail).toHaveAttribute('aria-expanded', 'true'));
    await userEvent.keyboard('{Escape}');
    await expect(rail).toHaveFocus();
    await expect(rail).toHaveAttribute('aria-expanded', 'false');
  },
};

export const MouseNavigation: Story = {
  ...LongDocument,
  tags: ['a11y-core-structure'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = await canvas.findByRole('navigation');
    if (isWide()) {
      // Column: fits the viewport before any scroll, scrolls on its own, and a click navigates.
      await expect(navigation).toHaveAttribute('data-presentation', 'column');
      const list = navigation.querySelector('ol')!;
      await waitFor(() => expect(list.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight));
      await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
      await expect(getComputedStyle(list).overscrollBehaviorY).toBe('contain');
      const pageTop = window.scrollY;
      list.scrollTop = list.scrollHeight;
      await expect(window.scrollY).toBe(pageTop);
      const last = within(navigation).getByRole('link', { name: 'Section 60' });
      await expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom + 1);
      await userEvent.click(last);
      await waitFor(() => expect(canvas.getByRole('heading', { name: 'Section 60' })).toHaveFocus());
      await waitFor(() => expect(last).toHaveAttribute('aria-current', 'location'), { timeout: 3000 });
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    const rail = within(navigation).getByRole('link', { name: navigation.getAttribute('aria-label')! });
    await userEvent.hover(rail);
    await waitFor(() => expect(rail).toHaveAttribute('aria-expanded', 'true'));
    const last = within(navigation).getByRole('link', { name: 'Section 60' });
    const list = navigation.querySelector('ol')!;
    const pageTop = window.scrollY;
    list.scrollTop = list.scrollHeight;
    await expect(window.scrollY).toBe(pageTop);
    const listBounds = list.getBoundingClientRect();
    await expect(listBounds.top).toBeGreaterThanOrEqual(0);
    await expect(listBounds.bottom).toBeLessThanOrEqual(window.innerHeight);
    await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    await expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(listBounds.bottom);
    await expect(getComputedStyle(list).overscrollBehaviorY).toBe('contain');
    await expect(getComputedStyle(list).overflowY).toBe('auto');
    await userEvent.click(last);
    await waitFor(() => expect(canvas.getByRole('heading', { name: 'Section 60' })).toHaveFocus());
    await expect(rail).toHaveAttribute('aria-expanded', 'true');
    // Focus moves before smooth scrolling finishes; current location follows the
    // actual reading position, including a short last section at the page edge.
    await waitFor(() => expect(last).toHaveAttribute('aria-current', 'location'), { timeout: 3000 });
    await userEvent.unhover(last);
    await waitFor(() => expect(rail).toHaveAttribute('aria-expanded', 'false'));
    await userEvent.hover(rail);
    await waitFor(() => expect(rail).toHaveAttribute('aria-expanded', 'true'));
    await expect(list.scrollTop).toBe(0);
    const first = within(navigation).getByRole('link', { name: 'Section 1' });
    await userEvent.click(first);
    await userEvent.unhover(first);
    await waitFor(() => expect(rail).toHaveAttribute('aria-expanded', 'false'));
  },
};
