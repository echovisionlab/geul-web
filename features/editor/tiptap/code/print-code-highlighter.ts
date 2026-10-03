import { createBundledHighlighter, createSingletonShorthands, guessEmbeddedLanguages } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import { bundledLanguages } from 'shiki/langs';

// Keep Shiki's complete lazy language/alias registry, including embedded grammars,
// while excluding themes that print source never uses from the client chunk graph.
const createHighlighter = createBundledHighlighter({
  langs: bundledLanguages,
  themes: {
    'github-light': () => import('shiki/themes/github-light.mjs'),
    'github-dark': () => import('shiki/themes/github-dark.mjs'),
  },
  engine: () => createOnigurumaEngine(import('shiki/wasm')),
});

export const { codeToHtml } = createSingletonShorthands(createHighlighter, { guessEmbeddedLanguages });
