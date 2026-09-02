import loader from '@monaco-editor/loader';
import * as monaco from 'monaco-editor';
import { ModuleResolutionKind, typescriptDefaults } from 'monaco-editor/language/typescript/monaco.contribution';
import { localMonacoWorkerKind } from './monaco-worker-label';

typescriptDefaults.setCompilerOptions({
  ...typescriptDefaults.getCompilerOptions(),
  moduleResolution: ModuleResolutionKind.NodeJs,
  allowNonTsExtensions: true,
  baseUrl: 'inmemory://model/',
});

type MonacoEnvironment = {
  getWorker?: (moduleId: string, label: string) => Worker;
};

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: MonacoEnvironment;
};

// Supplying the installed ESM module prevents @monaco-editor/loader from using
// its default CDN path. The editor and language workers are emitted by the app
// bundler from the two local worker entrypoints below.
loader.config({ monaco });

if (typeof Worker !== 'undefined') {
  const monacoGlobal = globalThis as MonacoGlobal;
  const currentEnvironment = monacoGlobal.MonacoEnvironment;
  monacoGlobal.MonacoEnvironment = {
    ...currentEnvironment,
    getWorker: (_moduleId, label) => {
      const kind = localMonacoWorkerKind(label);
      if (kind === 'typescript') {
        return new Worker(new URL('./monaco-typescript.worker.ts', import.meta.url), {
          name: 'tiptap-monaco-typescript',
          type: 'module',
        });
      }
      if (kind === 'html') {
        return new Worker(new URL('./monaco-html.worker.ts', import.meta.url), {
          name: 'tiptap-monaco-html',
          type: 'module',
        });
      }
      if (kind === 'css') {
        return new Worker(new URL('./monaco-css.worker.ts', import.meta.url), {
          name: 'tiptap-monaco-css',
          type: 'module',
        });
      }
      if (kind === 'json') {
        return new Worker(new URL('./monaco-json.worker.ts', import.meta.url), {
          name: 'tiptap-monaco-json',
          type: 'module',
        });
      }
      return new Worker(new URL('./monaco-editor.worker.ts', import.meta.url), {
        name: 'tiptap-monaco-editor',
        type: 'module',
      });
    },
  };
}

export { monaco };
