import { availableParallelism } from 'node:os';

const suites = {
  all: { tag: 'test' },
  a11y: { tag: 'a11y-smoke', titleId: 'core-interaction-accessibility' },
  author: { tag: 'a11y-author', titleId: 'pages-editors-post' },
  'email-rendering': { tag: 'email-rendering' },
};

/** Preserve the former tag/file-filter intersection, then isolate individual stories. */
export function selectBrowserStories(index, suite) {
  const selections = suite === 'ci' ? [suites.a11y, suites.author, suites['email-rendering']] : [suites[suite]];
  if (selections.some((selection) => !selection)) throw new Error(`Unknown Storybook suite: ${suite}`);
  if (index.v !== 5) throw new Error(`Expected Storybook index v5, received ${index.v}`);
  const stories = Object.values(index.entries)
    .filter((story) => story.type === 'story')
    .filter((story) =>
      selections.some(
        (selection) =>
          story.tags?.includes(selection.tag) && (!selection.titleId || story.id.startsWith(`${selection.titleId}--`)),
      ),
    )
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const ids = stories.map((story) => story.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate story IDs in browser test index');
  if (ids.some((id) => !/^[a-z0-9][a-z0-9-]*--[a-z0-9-]+$/.test(id))) {
    throw new Error('Unsafe story ID in browser test index');
  }
  return stories;
}

/** Local commands keep their existing limit; only CI queries and uses every available CPU. */
export function browserWorkerCount(ci, parallelism = availableParallelism) {
  return ci ? parallelism() : 2;
}

/** CI=true alone is also used by local tooling; this repository runs CI in GitHub Actions. */
export function isStorybookCI(environment) {
  return environment.GITHUB_ACTIONS === 'true' && ['true', '1'].includes(environment.CI);
}

/**
 * Partition the sorted story IDs, never the run's random artifact paths.
 * @template T
 * @param {readonly T[]} stories
 * @param {number} index
 * @param {number} count
 * @returns {T[]}
 */
export function shardBrowserStories(stories, index, count) {
  if (!Number.isInteger(index) || !Number.isInteger(count) || index < 1 || count < 1 || index > count) {
    throw new Error('Invalid Storybook shard');
  }
  return stories.filter((_, position) => position % count === index - 1);
}
