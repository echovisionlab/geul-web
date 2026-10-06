export interface ToolContext {
  locale: string;
  colorScheme: 'light' | 'dark';
}
export interface MountedTool {
  update: (context: ToolContext) => void;
  destroy: () => void;
}
export interface ToolModule {
  mount: (host: HTMLElement, context: ToolContext & { signal?: AbortSignal }) => Promise<MountedTool>;
}

export async function loadToolModule(uri: string): Promise<ToolModule> {
  const module: ToolModule = await import(/* webpackIgnore: true */ uri);
  if (typeof module.mount !== 'function') {
    throw new Error('Tool module must export mount');
  }
  return module;
}
