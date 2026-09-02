declare module 'monaco-editor/language/typescript/monaco.contribution' {
  export enum ModuleResolutionKind {
    Classic = 1,
    NodeJs = 2,
  }

  export interface TypeScriptLanguageServiceDefaults {
    getCompilerOptions(): Record<string, unknown>;
    setCompilerOptions(options: Record<string, unknown>): void;
    addExtraLib(content: string, filePath?: string): { dispose(): void };
  }

  export const typescriptDefaults: TypeScriptLanguageServiceDefaults;
}
