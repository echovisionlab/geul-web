import { Extension as BaseTiptapExtension, type AnyExtension, type ExtensionConfig } from '@tiptap/core';

export type NoOptions = Record<string, never>;
export type NoStorage = Record<string, never>;

export type TiptapAnyExtension = AnyExtension;
export type TiptapExtensionConfig<Options = NoOptions, Storage = NoStorage> = ExtensionConfig<Options, Storage>;
export type TiptapExtensionInstance<Options = NoOptions, Storage = NoStorage> = BaseTiptapExtension<Options, Storage>;

export function createTiptapExtension(
  config: Partial<TiptapExtensionConfig> | (() => Partial<TiptapExtensionConfig>),
): TiptapExtensionInstance {
  return BaseTiptapExtension.create<NoOptions, NoStorage>(config);
}
