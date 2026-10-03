import { resolve } from 'node:path';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

describe('public browser client module boundaries', () => {
  it.each(['file', 'post', 'privacy', 'program-event', 'release', 'terms', 'work'])(
    '%s loads only its public service descriptor and public transport',
    async (domain) => {
      const result = await build({
        entryPoints: [resolve(__dirname, `public-${domain}.ts`)],
        bundle: true,
        write: false,
        metafile: true,
        packages: 'external',
        format: 'esm',
        platform: 'browser',
      });
      const inputs = Object.keys(result.metafile.inputs);
      expect(inputs).toHaveLength(2);
      expect(inputs.some((input) => input.endsWith('/public-transport.ts'))).toBe(true);
      expect(inputs.some((input) => input.endsWith(`/public-${domain}.ts`))).toBe(true);
      const imports = Object.values(result.metafile.outputs)
        .flatMap((output) => output.imports)
        .map((entry) => entry.path);
      expect(
        imports.every(
          (path) => path.startsWith('@connectrpc/') || path.startsWith('@echovisionlab/geul-proto/public/'),
        ),
      ).toBe(true);
      const descriptorImports = imports.filter((path) => path.startsWith('@echovisionlab/geul-proto/'));
      expect(descriptorImports).toEqual([`@echovisionlab/geul-proto/public/${domain.replaceAll('-', '_')}_pb.ts`]);
    },
  );
});
