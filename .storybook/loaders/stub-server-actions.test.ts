import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const stubServerActions = createRequire(import.meta.url)('./stub-server-actions.cjs') as (
  this: { resourcePath: string },
  source: string,
) => string;
const load = (source: string) => stubServerActions.call({ resourcePath: 'actions.ts' }, source);

describe('stubServerActions', () => {
  it('leaves modules without the directive unchanged', () => {
    const source = "import { a } from './a';\nexport const b = a;\n";
    expect(load(source)).toBe(source);
  });

  it('replaces each action with a throwing stub and drops the server imports', async () => {
    const stub = load(
      "'use server';\n\nimport { revalidatePath } from 'next/cache';\nexport type Row = { id: string };\n" +
        'export async function saveAction(id: string) {\n  revalidatePath(id);\n}\n',
    );
    expect(stub).not.toContain('import');
    const module = await import(`data:text/javascript,${encodeURIComponent(stub)}`);
    await expect(module.saveAction()).rejects.toThrow('saveAction is a server action');
  });

  it('rejects other runtime exports instead of bundling them', () => {
    expect(() => load("'use server';\nexport const limit = 3;\n")).toThrow('may only export async functions');
  });

  it('stubs every server action module in the app without leaking its imports', () => {
    const files = execFileSync('git', ['grep', '-lE', '^[\'"]use server[\'"]', '--', '*.ts', '*.tsx'], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n');
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const stub = stubServerActions.call({ resourcePath: file }, readFileSync(file, 'utf8'));
      expect(stub, file).toMatch(/^export async function /);
      expect(stub, file).not.toContain('import');
    }
  });
});
