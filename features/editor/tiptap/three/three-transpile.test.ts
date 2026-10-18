import { transpileThreeSceneSource } from './three-transpile';

it('emits executable JavaScript from TypeScript without module wrappers or deprecation diagnostics', () => {
  const result = transpileThreeSceneSource(
    "import * as THREE from 'three';\nfunction frame(time: number): number { return Math.round(time); }",
  );
  expect(result.type).toBe('compiled');
  if (result.type !== 'compiled') {
    return;
  }
  expect(result.source).not.toContain(': number');
  expect(result.source).not.toContain('exports.');
  expect(result.source).not.toContain('require(');
  expect(result.source).not.toContain("from 'three'");
  const program = new Function(`${result.source}\nreturn { frame };`)() as { frame: (time: number) => number };
  expect(program.frame(4.6)).toBe(5);
});
