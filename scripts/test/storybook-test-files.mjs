import { createRequire } from 'node:module';

// Resolve the emitter's own Babel dependencies, including under pnpm isolation.
const require = createRequire(import.meta.url);
const runnerRequire = createRequire(require.resolve('@storybook/test-runner/package.json'));
// Keep the Node emitter boundary from importing Storybook's renderer declarations
// into the application type graph. The runtime still uses its public helper.
const { testPrefixer } = runnerRequire('@storybook/test-runner');
const t = runnerRequire('@babel/types');
const babelGenerator = runnerRequire('@babel/generator');
const generate = babelGenerator.default ?? babelGenerator;

/**
 * Keep Storybook's public play/hook/error/retry implementation; change only file ownership.
 * @param {{ id: string, title: string, name: string, tags: string[] }} story
 * @returns {string}
 */
export function browserStorySource(story) {
  const emitted = testPrefixer({
    id: t.stringLiteral(story.id),
    title: t.stringLiteral(story.title),
    name: t.stringLiteral(story.name),
    storyExport: t.identifier('story'),
  });
  const testFunction = emitted[1]?.expression;
  if (testFunction?.type !== 'ArrowFunctionExpression') {
    throw new Error('Storybook testPrefixer output changed; review the story-file adapter');
  }
  const test = t.expressionStatement(
    t.callExpression(t.identifier('it'), [
      t.stringLiteral(story.tags.includes('play-fn') ? 'play-test' : 'smoke-test'),
      testFunction,
    ]),
  );
  return generate(
    t.program([
      t.expressionStatement(
        t.callExpression(t.identifier('describe'), [
          t.stringLiteral(`${story.title} / ${story.name}`),
          t.arrowFunctionExpression([], t.blockStatement([test])),
        ]),
      ),
    ]),
  ).code;
}
