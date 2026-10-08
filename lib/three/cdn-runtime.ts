import manifest from './cdn-runtime-manifest.json';

type ThreeModule = typeof import('three');
type IonianModule = typeof import('@echovisionlab/ionian');
type ImportRuntime = (url: string) => Promise<unknown>;
type ImportIonian = () => Promise<IonianModule>;

// Keep native browser imports in both Next/Turbopack and Storybook/Webpack.
const importRuntime: ImportRuntime = (url) => import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);
export const THREE_CDN_TIMEOUT_MS = 15_000;

function withTimeout<T>(pending: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('The Three.js CDN did not respond in time.')),
      THREE_CDN_TIMEOUT_MS,
    );
    pending.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** One runtime per browser realm. Failures clear the loader cache for a later attempt. */
export function createThreeCdnRuntimeLoader(
  importModule: ImportRuntime = importRuntime,
  importIonian: ImportIonian = () => import('@echovisionlab/ionian'),
) {
  let three: Promise<ThreeModule> | undefined;
  let ionian: Promise<IonianModule> | undefined;
  const loader = {
    loadThree(): Promise<ThreeModule> {
      three ??= withTimeout(importModule(manifest.threeUrl))
        .then((value) => {
          const module = value as ThreeModule;
          if (
            module?.REVISION !== manifest.versions.three.split('.')[1] ||
            typeof module.WebGLRenderer !== 'function'
          ) {
            throw new Error('The Three.js CDN runtime does not match the installed types.');
          }
          return module;
        })
        .catch((error: unknown) => {
          three = undefined;
          throw error;
        });
      return three;
    },
    loadIonian(): Promise<IonianModule> {
      // This import is bundled from npm. Its Three imports resolve to the app's
      // generated adapter, which awaits this same jsDelivr runtime.
      ionian ??= withTimeout(loader.loadThree().then(() => importIonian()))
        .then((value) => {
          const module = value as IonianModule;
          if (typeof module?.ParticlesEngine !== 'function') {
            throw new Error('The Ionian runtime is unavailable.');
          }
          return module;
        })
        .catch((error: unknown) => {
          ionian = undefined;
          throw error;
        });
      return ionian;
    },
  };
  return loader;
}

const runtime = createThreeCdnRuntimeLoader();
export const loadThreeRuntime = runtime.loadThree;
export const loadIonianRuntime = runtime.loadIonian;
