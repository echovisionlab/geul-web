import ts from '@typescript/tooling';
import { stripThreeSceneRuntimeImport, type ThreeSceneError } from './three-source';

export type ThreeSceneTranspileResult =
  { type: 'compiled'; source: string } | { type: 'error'; error: ThreeSceneError };

/**
 * Removes the one visible virtual `three` import, then emits script-compatible
 * JavaScript. Other imports/exports remain forbidden by source policy, so the
 * isolated Function runtime never receives module syntax or CommonJS wrappers.
 */
export function transpileThreeSceneSource(source: string): ThreeSceneTranspileResult {
  const result = ts.transpileModule(stripThreeSceneRuntimeImport(source), {
    fileName: 'three-scene.ts',
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      isolatedModules: true,
      removeComments: false,
      sourceMap: false,
    },
  });
  const diagnostic = result.diagnostics?.find((candidate) => candidate.category === ts.DiagnosticCategory.Error);
  if (diagnostic) {
    const location =
      diagnostic.file && typeof diagnostic.start === 'number'
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : null;
    return {
      type: 'error',
      error: {
        kind: 'compile',
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
        ...(location ? { line: location.line + 1, column: location.character + 1 } : {}),
      },
    };
  }
  return { type: 'compiled', source: result.outputText };
}
