import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';

export interface CollaborationAwarenessProvider {
  awareness?: Awareness | null;
}

interface CollaborationConfigOptions {
  provider: CollaborationAwarenessProvider;
  doc: Y.Doc;
  fragmentName?: string;
  /** Authenticated collaborator name, published through Yjs awareness. */
  userName: string;
  userColor?: string;
}

function generateRandomColor(): string {
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, '0')}`;
}

const hexColor = /^#[0-9a-f]{6}$/i;

/**
 * Resolves collaboration authority without choosing an editor engine.
 * Consumers pass this result directly to TiptapEditor or
 * createCollaborationExtension.
 */
export function createCollaborationConfig(options: CollaborationConfigOptions) {
  const { provider, doc, fragmentName = 'document-store', userName, userColor } = options;
  const resolvedUserName = userName.trim();
  if (!resolvedUserName) {
    throw new Error('Collaboration requires a non-empty authenticated user name.');
  }

  const resolvedUserColor = (userColor ?? generateRandomColor()).toLowerCase();
  if (!hexColor.test(resolvedUserColor)) {
    throw new Error('Collaboration user color must be a six-digit hex color (#RRGGBB).');
  }

  return {
    fragment: doc.getXmlFragment(fragmentName),
    awareness: provider.awareness ?? undefined,
    localUser: {
      name: resolvedUserName,
      color: resolvedUserColor,
    },
  };
}
