import { Plugin } from '@tiptap/pm/state';
import { TranslationStructureLockExtension } from '@/lib/editor/extensions/TranslationStructureLockExtension';

/** Keep the translation guard installed while its authority changes in place. */
export function createLiveTranslationStructureLock(isLocked: () => boolean) {
  return TranslationStructureLockExtension.extend({
    addProseMirrorPlugins() {
      // Reuse the owning guard's transaction, keyboard and decoration contracts.
      const guard = this.parent?.();
      return (guard ?? []).map(
        (plugin) =>
          new Plugin({
            ...plugin.spec,
            filterTransaction: (transaction, state) =>
              !isLocked() || plugin.spec.filterTransaction?.call(plugin, transaction, state) !== false,
            props: {
              ...plugin.props,
              handleKeyDown: (view, event) =>
                isLocked() && plugin.props.handleKeyDown?.call(plugin, view, event) === true,
              handleDOMEvents: {
                beforeinput: (view, event) =>
                  isLocked() && plugin.props.handleDOMEvents?.beforeinput?.call(plugin, view, event) === true,
              },
              decorations: (state) => (isLocked() ? (plugin.props.decorations?.call(plugin, state) ?? null) : null),
            },
          }),
      );
    },
  });
}
