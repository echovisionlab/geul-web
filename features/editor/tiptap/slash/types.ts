import type { Icon } from '@tabler/icons-react';
import type { Messages } from 'next-intl';

export type TiptapSlashNodeName =
  | 'paragraph'
  | 'heading'
  | 'bulletListItem'
  | 'numberedListItem'
  | 'checkListItem'
  | 'quote'
  | 'callout'
  | 'codeBlock'
  | 'divider'
  | 'math'
  | 'mathInline'
  | 'table';

export type TiptapSlashCapability =
  'math' | 'table' | 'emoji' | 'map' | 'file' | 'externalVideo' | 'p5' | 'three' | 'shader' | 'ai';

export type TiptapSlashWorkflow = Exclude<TiptapSlashCapability, 'math' | 'table'>;

export type TiptapSlashCapabilities = Partial<Record<TiptapSlashCapability, boolean>>;

export type TiptapSlashIntrinsicKey =
  | 'paragraph'
  | 'heading'
  | 'heading_2'
  | 'heading_3'
  | 'bullet_list'
  | 'numbered_list'
  | 'check_list'
  | 'quote'
  | 'callout'
  | 'code_block'
  | 'divider';

export type TiptapSlashIntrinsicAvailability = Partial<Record<TiptapSlashIntrinsicKey, boolean>>;

export interface TiptapSlashRange {
  from: number;
  to: number;
  contentPosition: number;
  blockId: string;
}

export type TiptapSlashPlacement = 'replace' | 'after';

export interface TiptapSlashActionContext {
  /** Existing durable block that still contains the captured slash trigger. */
  readonly blockId: string;
  /**
   * Durable ID owned by the successful result. It equals `blockId` for a
   * slash-only replacement and is fresh when a prefix block must be kept.
   */
  readonly targetBlockId: string;
  readonly placement: TiptapSlashPlacement;
  readonly triggerText: string;
  /** Exact captured content node; a still-present block must match before a delayed workflow mutates it. */
  readonly anchorContentJSON: string;
  readonly range: Readonly<TiptapSlashRange>;
}

/** `true` means the callback applied exactly one editor document mutation. */
export type TiptapSlashWorkflowCallback = (context: TiptapSlashActionContext) => boolean | void;

export type TiptapSlashWorkflowCallbacks = Partial<Record<TiptapSlashWorkflow, TiptapSlashWorkflowCallback>>;

export type TiptapSlashIntrinsicExecution =
  | { type: 'intrinsic'; nodeName: 'heading'; attributes: { readonly level: 1 | 2 | 3 } }
  | {
      type: 'intrinsic';
      nodeName: Exclude<TiptapSlashNodeName, 'heading'>;
      attributes?: undefined;
    };

export type TiptapSlashItemExecution =
  TiptapSlashIntrinsicExecution | { type: 'workflow'; workflow: TiptapSlashWorkflow };

export interface TiptapSlashItem {
  key: string;
  title: string;
  subtext: string;
  aliases: readonly string[];
  group: string;
  icon: Icon;
  capability?: TiptapSlashCapability;
  enabled: boolean;
  unavailableReason?: string;
  execution: TiptapSlashItemExecution;
}

type EditorSlashMenuMessages = Messages['editorCommon']['editor']['slashMenu'];
type TiptapSlashMenuItemKey =
  | 'heading'
  | 'heading2'
  | 'heading3'
  | 'paragraph'
  | 'bulletList'
  | 'numberedList'
  | 'checkList'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'codeBlock'
  | 'table'
  | 'emoji'
  | 'mathBlock'
  | 'inlineMath'
  | 'map'
  | 'externalVideo'
  | 'p5Sketch'
  | 'threeScene'
  | 'shader'
  | 'file'
  | 'aiAssistant';

export type TiptapSlashMenuMessages = Pick<EditorSlashMenuMessages, 'placeholder' | 'unavailable'> & {
  groups: EditorSlashMenuMessages['groups'];
  items: {
    [Key in TiptapSlashMenuItemKey]: Omit<EditorSlashMenuMessages['items'][Key], 'aliases'> & {
      aliases: readonly string[];
    };
  };
};

export type TiptapSlashExecutionResult =
  | { status: 'applied'; editorMutations: 1 }
  | { status: 'delegated'; editorMutations: 0; workflow: TiptapSlashWorkflow }
  | { status: 'unavailable' }
  | { status: 'invalid' };
