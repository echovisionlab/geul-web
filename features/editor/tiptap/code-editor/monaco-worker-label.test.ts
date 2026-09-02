import { describe, expect, it } from 'vitest';
import { localMonacoWorkerKind } from './monaco-worker-label';

describe('localMonacoWorkerKind', () => {
  it.each([
    ['javascript', 'typescript'],
    ['typescript', 'typescript'],
    ['html', 'html'],
    ['handlebars', 'html'],
    ['css', 'css'],
    ['scss', 'css'],
    ['less', 'css'],
    ['json', 'json'],
    ['glsl', 'editor'],
  ] as const)('routes %s to the local %s worker', (label, expected) => {
    expect(localMonacoWorkerKind(label)).toBe(expected);
  });
});
