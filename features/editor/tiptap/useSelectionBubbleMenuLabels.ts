'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { SelectionBubbleMenuLabels } from './menus';

export function useSelectionBubbleMenuLabels() {
  const editorMessages = useTranslations('editorCommon.editor');
  const commonLabels = useTranslations('common.labels');
  const commonActions = useTranslations('common.actions');
  const labels = useMemo<SelectionBubbleMenuLabels>(
    () => ({
      menu: editorMessages('formatting.blockType'),
      more: commonLabels('options'),
      blockType: editorMessages('formatting.blockType'),
      blockTypes: {
        paragraph: editorMessages('slashMenu.items.paragraph.title'),
        'heading-1': editorMessages('slashMenu.items.heading.title'),
        'heading-2': editorMessages('slashMenu.items.heading2.title'),
        'heading-3': editorMessages('slashMenu.items.heading3.title'),
        bulletListItem: editorMessages('slashMenu.items.bulletList.title'),
        numberedListItem: editorMessages('slashMenu.items.numberedList.title'),
        checkListItem: editorMessages('slashMenu.items.checkList.title'),
        quote: editorMessages('slashMenu.items.quote.title'),
        codeBlock: editorMessages('slashMenu.items.codeBlock.title'),
      },
      formatting: {
        bold: editorMessages('formatting.bold'),
        italic: editorMessages('formatting.italic'),
        underline: editorMessages('formatting.underline'),
        strike: editorMessages('formatting.strike'),
        code: editorMessages('formatting.code'),
      },
      alignment: {
        group: editorMessages('formatting.alignment'),
        left: editorMessages('formatting.alignLeft'),
        center: editorMessages('formatting.alignCenter'),
        right: editorMessages('formatting.alignRight'),
      },
      colors: {
        button: editorMessages('drag.colors'),
        text: editorMessages('colors.text'),
        background: editorMessages('colors.background'),
        values: {
          default: editorMessages('colors.names.default'),
          gray: editorMessages('colors.names.gray'),
          brown: editorMessages('colors.names.brown'),
          red: editorMessages('colors.names.red'),
          orange: editorMessages('colors.names.orange'),
          yellow: editorMessages('colors.names.yellow'),
          green: editorMessages('colors.names.green'),
          blue: editorMessages('colors.names.blue'),
          purple: editorMessages('colors.names.purple'),
          pink: editorMessages('colors.names.pink'),
        },
      },
      nest: editorMessages('formatting.nest'),
      unnest: editorMessages('formatting.unnest'),
      link: {
        create: editorMessages('link.create'),
        open: editorMessages('link.open'),
        edit: editorMessages('link.edit'),
        remove: editorMessages('link.remove'),
        url: editorMessages('link.urlPlaceholder'),
        text: editorMessages('link.titlePlaceholder'),
        textPlaceholder: editorMessages('link.titlePlaceholder'),
        urlPlaceholder: editorMessages('link.urlPlaceholder'),
        save: commonActions('save'),
        cancel: commonActions('cancel'),
      },
      inlineMath: editorMessages('formatting.inlineMath'),
      ai: editorMessages('formatting.ai'),
    }),
    [commonActions, commonLabels, editorMessages],
  );
  return labels;
}
