import { createContext, useContext, type ReactNode } from 'react';
import type { NodeViewProps } from '@tiptap/react';

export const EditorRuntimeOptions = createContext<ReadonlyMap<string, object>>(new Map());

/** React portals receive current options without rebuilding the ProseMirror view. */
export function liveNodeView<T extends object>(
  name: string,
  fallback: T,
  render: (props: NodeViewProps, options: T) => ReactNode,
) {
  return function LiveNodeView(props: NodeViewProps) {
    const options = useContext(EditorRuntimeOptions).get(name) as T | undefined;
    return render(props, options ?? fallback);
  };
}
