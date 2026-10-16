// @geul-test-tier node-unit
import { describe, expect, it, vi } from 'vitest';
import {
  browserWorkerCount,
  isStorybookCI,
  selectBrowserStories,
  shardBrowserStories,
} from './storybook-browser-plan.mjs';
import { browserStorySource } from './storybook-test-files.mjs';

const story = (id: string, tags: string[]) => ({
  id,
  tags,
  type: 'story',
  title: 'Core/Interaction/Accessibility',
  name: id,
});
const index = {
  v: 5,
  entries: {
    keyboard: story('core-interaction-accessibility--keyboard', ['test', 'a11y-smoke', 'play-fn']),
    dialog: story('core-interaction-accessibility--dialog', ['test', 'a11y-smoke']),
    untagged: story('core-interaction-accessibility--untagged', ['test']),
    differentFile: story('core-other--keyboard', ['test', 'a11y-smoke']),
    author: story('pages-editors-post--keyboard-authoring', ['test', 'a11y-author', 'play-fn']),
    differentAuthor: story('pages-editors-work--keyboard-authoring', ['test', 'a11y-author']),
    email: story('pages-admin-email-editors--template-rich-formatting', ['test', 'email-rendering', 'play-fn']),
    docs: { ...story('core-interaction-accessibility--docs', ['a11y-smoke']), type: 'docs' },
  },
};

describe('Storybook browser execution plan', () => {
  it('preserves the smoke and author tag/file intersections without including unrelated or docs entries', () => {
    expect(selectBrowserStories(index, 'a11y').map((entry) => entry.id)).toEqual([
      'core-interaction-accessibility--dialog',
      'core-interaction-accessibility--keyboard',
    ]);
    expect(selectBrowserStories(index, 'author').map((entry) => entry.id)).toEqual([
      'pages-editors-post--keyboard-authoring',
    ]);
    expect(selectBrowserStories(index, 'email-rendering').map((entry) => entry.id)).toEqual([
      'pages-admin-email-editors--template-rich-formatting',
    ]);
    expect(selectBrowserStories(index, 'all')).toHaveLength(7);
  });

  it('queries every available CPU only in CI, preserving the local limit without querying this computer', () => {
    const parallelism = vi.fn(() => 12);
    expect(browserWorkerCount(false, parallelism)).toBe(2);
    expect(parallelism).not.toHaveBeenCalled();
    expect(browserWorkerCount(true, parallelism)).toBe(12);
    expect(parallelism).toHaveBeenCalledOnce();
  });

  it('combines exactly the existing CI suites once, without broadening to all test-tagged stories', () => {
    const expected = [
      ...new Set(
        ['a11y', 'author', 'email-rendering'].flatMap((suite) =>
          selectBrowserStories(index, suite).map((entry) => entry.id),
        ),
      ),
    ].sort();
    const selected = selectBrowserStories(index, 'ci').map((entry) => entry.id);
    expect(selected).toEqual(expected);
    expect(selected).toHaveLength(4);
    expect(selected).not.toContain('core-interaction-accessibility--untagged');
    expect(selected).not.toContain('core-other--keyboard');
    expect(selected).not.toContain('pages-editors-work--keyboard-authoring');
  });

  it('retains the local limit when only CI=true was set for local tooling', () => {
    expect(isStorybookCI({ CI: 'true' })).toBe(false);
    expect(isStorybookCI({ GITHUB_ACTIONS: 'true', CI: 'false' })).toBe(false);
    expect(isStorybookCI({ GITHUB_ACTIONS: 'true', CI: 'true' })).toBe(true);
  });

  it('assigns every selected story to exactly one shard independently of each job artifact path', () => {
    const selected = selectBrowserStories(index, 'all');
    const first = shardBrowserStories(selected, 1, 2);
    const second = shardBrowserStories(selected, 2, 2);
    expect(first.filter((entry) => second.includes(entry))).toEqual([]);
    expect([...first, ...second].map((entry) => entry.id).sort()).toEqual(selected.map((entry) => entry.id).sort());
    expect(() => shardBrowserStories(selected, 3, 2)).toThrow('Invalid Storybook shard');
  });

  it('emits one independently schedulable test per story, retaining the official hooks, play, and retry body', () => {
    const stories = selectBrowserStories(index, 'a11y');
    const files = stories.map(browserStorySource);
    files.forEach((source, position) => {
      expect(source.match(/\bit\(/g)).toHaveLength(1);
      expect(source).toContain(JSON.stringify(stories[position].id));
      expect(source).not.toContain(JSON.stringify(stories[1 - position].id));
      expect(source).toContain('__sbPreVisit');
      expect(source).toContain('__sbPostVisit');
      expect(source).toContain('__test(id, hasPlayFn)');
      expect(source).toContain('resetPage');
      expect(source).toContain('__sbSetupPage');
    });
    expect(files[0]).toContain('smoke-test');
    expect(files[1]).toContain('play-test');
  });

  it('rejects duplicate IDs and incompatible indexes instead of silently dropping tests', () => {
    expect(() => selectBrowserStories({ ...index, v: 4 }, 'a11y')).toThrow('index v5');
    expect(() =>
      selectBrowserStories({ ...index, entries: { ...index.entries, duplicate: index.entries.keyboard } }, 'a11y'),
    ).toThrow('Duplicate story IDs');
  });
});
