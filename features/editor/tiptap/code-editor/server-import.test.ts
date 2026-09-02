import { describe, expect, it } from 'vitest';

describe('code editor server import boundary', () => {
  it('does not evaluate Monaco browser globals when importing the public barrel', async () => {
    const codeEditor = await import('./index');

    expect(codeEditor.MonacoSourceEditor).toBeTypeOf('function');
  });
});
