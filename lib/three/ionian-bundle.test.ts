import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';

it('bundles real Ionian while its transitive loaders share the supplied Three runtime', async () => {
  const root = resolve(__dirname, '../..');
  const temporary = await mkdtemp(resolve(tmpdir(), 'geul-ionian-bundle-'));
  try {
    const outfile = resolve(temporary, 'bundle.mjs');
    const result = await build({
      stdin: {
        contents: `export { ParticlesEngine } from '@echovisionlab/ionian';
          export { GLTFLoader } from 'three-stdlib';
          export { Mesh, Vector3 } from 'three';`,
        resolveDir: root,
      },
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      metafile: true,
      alias: { three: resolve(root, 'lib/three/three-cdn-module.generated.mjs') },
      plugins: [
        {
          name: 'supply-cdn-runtime',
          setup(builder) {
            builder.onResolve({ filter: /^\.\/cdn-runtime$/ }, () => ({ path: 'cdn-runtime', namespace: 'fixture' }));
            builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
              contents: 'export const loadThreeRuntime = async () => globalThis.__GEUL_TEST_THREE;',
              loader: 'js',
            }));
          },
        },
      ],
    });
    const inputs = Object.keys(result.metafile!.inputs).map((path) => path.replaceAll('\\', '/'));
    expect(inputs.some((path) => path.includes('/ionian/') && path.endsWith('dist/ionian.js'))).toBe(true);
    expect(inputs.filter((path) => /\/three\/(?:build|src)\//u.test(path))).toEqual([]);
    const threeUrl = pathToFileURL(resolve(root, 'node_modules/three/build/three.module.js')).href;
    const bundleUrl = pathToFileURL(outfile).href;
    const verification = `
      const THREE = await import(${JSON.stringify(threeUrl)});
      globalThis.__GEUL_TEST_THREE = THREE;
      const module = await import(${JSON.stringify(bundleUrl)});
      if (module.Mesh !== THREE.Mesh || module.Vector3 !== THREE.Vector3) throw Error('Different Three constructors');
      if (!(new module.GLTFLoader() instanceof THREE.Loader)) throw Error('Loader uses a different Three runtime');
      for (const method of ['setPointerFacing', 'setPointerFacingPosition', 'getPointerFacingOptions']) {
        if (typeof module.ParticlesEngine.prototype[method] !== 'function') throw Error('Missing Ionian API: ' + method);
      }
    `;
    execFileSync(process.execPath, ['--input-type=module', '-e', verification], { stdio: 'pipe' });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}, 15_000);
