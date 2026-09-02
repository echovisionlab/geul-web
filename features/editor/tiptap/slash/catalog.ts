import {
  IconBlockquote,
  IconBrandJavascript,
  IconBrandThreejs,
  IconBrandYoutube,
  IconBulb,
  IconCodeblock,
  IconCodeDots,
  IconFile,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconMap,
  IconMath,
  IconMathFunction,
  IconMinus,
  IconMoodSmile,
  IconSparkles,
  IconTable,
  type Icon,
} from '@tabler/icons-react';
import type {
  TiptapSlashCapabilities,
  TiptapSlashIntrinsicAvailability,
  TiptapSlashIntrinsicExecution,
  TiptapSlashItem,
  TiptapSlashMenuMessages,
  TiptapSlashWorkflow,
  TiptapSlashWorkflowCallbacks,
} from './types';

export interface CreateTiptapSlashCatalogOptions {
  /** Availability of always-local schema conversions for the embedding profile. */
  intrinsicAvailability?: TiptapSlashIntrinsicAvailability;
  /** Availability of optional schema features and externally owned workflows. */
  capabilities?: TiptapSlashCapabilities;
  /** Adapters for picker/dialog workflows. They never run for intrinsic items. */
  callbacks?: TiptapSlashWorkflowCallbacks;
  /** Optional localized reason for a missing Emoji adapter. */
  emojiUnavailableReason?: string;
}

type EditorSlashItem = TiptapSlashMenuMessages['items'][keyof TiptapSlashMenuMessages['items']];

function itemCopy(translation: EditorSlashItem, group: string, aliases = translation.aliases): EditorSlashItem {
  return { title: translation.title, subtext: translation.subtext, aliases, group };
}

function intrinsicItem({
  key,
  translation,
  icon,
  execution,
  enabled,
  unavailableReason,
  capability,
}: {
  key: string;
  translation: EditorSlashItem;
  icon: Icon;
  execution: TiptapSlashIntrinsicExecution;
  enabled: boolean;
  unavailableReason: string;
  capability?: 'math' | 'table';
}): TiptapSlashItem {
  return {
    key,
    ...translation,
    icon,
    execution,
    capability,
    enabled,
    unavailableReason: enabled ? undefined : unavailableReason,
  };
}

function workflowItem({
  key,
  translation,
  icon,
  workflow,
  capabilities,
  callbacks,
  unavailableReason,
}: {
  key: string;
  translation: EditorSlashItem;
  icon: Icon;
  workflow: TiptapSlashWorkflow;
  capabilities: TiptapSlashCapabilities;
  callbacks: TiptapSlashWorkflowCallbacks;
  unavailableReason: string;
}): TiptapSlashItem {
  const enabled = capabilities[workflow] === true && typeof callbacks[workflow] === 'function';
  return {
    key,
    ...translation,
    icon,
    capability: workflow,
    enabled,
    unavailableReason: enabled ? undefined : unavailableReason,
    execution: { type: 'workflow', workflow },
  };
}

/**
 * Geul catalog order. Executable creative workflows are appended
 * after the unified file item and before AI.
 */
export function createTiptapSlashCatalog(
  messages: TiptapSlashMenuMessages,
  {
    intrinsicAvailability = {},
    capabilities = {},
    callbacks = {},
    emojiUnavailableReason = messages.unavailable,
  }: CreateTiptapSlashCatalogOptions,
): TiptapSlashItem[] {
  const intrinsicEnabled = (key: keyof TiptapSlashIntrinsicAvailability) => intrinsicAvailability[key] !== false;
  const intrinsic = (
    key: keyof TiptapSlashIntrinsicAvailability,
    translation: EditorSlashItem,
    icon: Icon,
    execution: TiptapSlashIntrinsicExecution,
  ) =>
    intrinsicItem({
      key,
      translation,
      icon,
      execution,
      enabled: intrinsicEnabled(key),
      unavailableReason: messages.unavailable,
    });

  return [
    intrinsic('heading', itemCopy(messages.items.heading, messages.groups.headings), IconH1, {
      type: 'intrinsic',
      nodeName: 'heading',
      attributes: { level: 1 },
    }),
    intrinsic('heading_2', itemCopy(messages.items.heading2, messages.groups.headings), IconH2, {
      type: 'intrinsic',
      nodeName: 'heading',
      attributes: { level: 2 },
    }),
    intrinsic('heading_3', itemCopy(messages.items.heading3, messages.groups.headings), IconH3, {
      type: 'intrinsic',
      nodeName: 'heading',
      attributes: { level: 3 },
    }),
    intrinsic('quote', itemCopy(messages.items.quote, messages.groups.basic), IconBlockquote, {
      type: 'intrinsic',
      nodeName: 'quote',
    }),
    intrinsic('callout', itemCopy(messages.items.callout, messages.groups.basic), IconBulb, {
      type: 'intrinsic',
      nodeName: 'callout',
    }),
    intrinsic('numbered_list', itemCopy(messages.items.numberedList, messages.groups.basic), IconListNumbers, {
      type: 'intrinsic',
      nodeName: 'numberedListItem',
    }),
    intrinsic('bullet_list', itemCopy(messages.items.bulletList, messages.groups.basic), IconList, {
      type: 'intrinsic',
      nodeName: 'bulletListItem',
    }),
    intrinsic('check_list', itemCopy(messages.items.checkList, messages.groups.basic), IconListCheck, {
      type: 'intrinsic',
      nodeName: 'checkListItem',
    }),
    intrinsic('paragraph', itemCopy(messages.items.paragraph, messages.groups.basic), IconList, {
      type: 'intrinsic',
      nodeName: 'paragraph',
    }),
    intrinsic('code_block', itemCopy(messages.items.codeBlock, messages.groups.basic), IconCodeblock, {
      type: 'intrinsic',
      nodeName: 'codeBlock',
    }),
    intrinsic('divider', itemCopy(messages.items.divider, messages.groups.basic), IconMinus, {
      type: 'intrinsic',
      nodeName: 'divider',
    }),
    intrinsicItem({
      key: 'table',
      translation: itemCopy(messages.items.table, messages.groups.advanced),
      icon: IconTable,
      execution: { type: 'intrinsic', nodeName: 'table' },
      capability: 'table',
      enabled: capabilities.table === true,
      unavailableReason: messages.unavailable,
    }),
    workflowItem({
      key: 'emoji',
      translation: itemCopy(messages.items.emoji, messages.groups.others),
      icon: IconMoodSmile,
      workflow: 'emoji',
      capabilities,
      callbacks,
      unavailableReason: emojiUnavailableReason,
    }),
    intrinsicItem({
      key: 'math',
      translation: itemCopy(messages.items.mathBlock, messages.groups.math),
      icon: IconMath,
      execution: { type: 'intrinsic', nodeName: 'math' },
      capability: 'math',
      enabled: capabilities.math === true,
      unavailableReason: messages.unavailable,
    }),
    intrinsicItem({
      key: 'inline-math',
      translation: itemCopy(messages.items.inlineMath, messages.groups.inline),
      icon: IconMathFunction,
      execution: { type: 'intrinsic', nodeName: 'mathInline' },
      capability: 'math',
      enabled: capabilities.math === true,
      unavailableReason: messages.unavailable,
    }),
    workflowItem({
      key: 'map',
      translation: itemCopy(messages.items.map, messages.groups.embeds),
      icon: IconMap,
      workflow: 'map',
      capabilities,
      callbacks,
      unavailableReason: messages.unavailable,
    }),
    workflowItem({
      key: 'external-video',
      translation: itemCopy(messages.items.externalVideo, messages.groups.embeds),
      icon: IconBrandYoutube,
      workflow: 'externalVideo',
      capabilities,
      callbacks,
      unavailableReason: messages.unavailable,
    }),
    workflowItem({
      key: 'file',
      translation: itemCopy(messages.items.file, messages.groups.media),
      icon: IconFile,
      workflow: 'file',
      capabilities,
      callbacks,
      unavailableReason: messages.unavailable,
    }),
    workflowItem({
      key: 'p5',
      translation: itemCopy(messages.items.p5Sketch, messages.groups.embeds),
      icon: IconBrandJavascript,
      workflow: 'p5',
      capabilities,
      callbacks,
      unavailableReason: messages.unavailable,
    }),
    workflowItem({
      key: 'three',
      translation: itemCopy(messages.items.threeScene, messages.groups.embeds),
      icon: IconBrandThreejs,
      workflow: 'three',
      capabilities,
      callbacks,
      unavailableReason: messages.unavailable,
    }),
    workflowItem({
      key: 'shader',
      translation: itemCopy(messages.items.shader, messages.groups.embeds),
      icon: IconCodeDots,
      workflow: 'shader',
      capabilities,
      callbacks,
      unavailableReason: messages.unavailable,
    }),
    workflowItem({
      key: 'ai',
      translation: itemCopy(messages.items.aiAssistant, messages.groups.ai),
      icon: IconSparkles,
      workflow: 'ai',
      capabilities,
      callbacks,
      unavailableReason: messages.unavailable,
    }),
  ];
}

export function tiptapSlashItemMatchesQuery(item: TiptapSlashItem, query: string, locale: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  if (!normalizedQuery) {
    return true;
  }
  return [item.key, item.title, item.subtext, ...item.aliases].some((value) =>
    value.toLocaleLowerCase(locale).includes(normalizedQuery),
  );
}

export function filterTiptapSlashCatalog(
  items: readonly TiptapSlashItem[],
  query: string,
  locale: string,
): TiptapSlashItem[] {
  return items.filter((item) => tiptapSlashItemMatchesQuery(item, query, locale));
}

export function selectableTiptapSlashItems(items: readonly TiptapSlashItem[]): TiptapSlashItem[] {
  return items.filter((item) => item.enabled);
}
