'use client';

import { useEffect, useId, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { resolveSiteVariable, type SiteVariableContext } from '@echovisionlab/geul-common/site-variables';
import { isSiteVariableKey, siteVariableKeys } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { InlineReference } from '@/components/core/InlineReference/InlineReference';
import { Popover } from '@/components/core/Popover';
import { Select, Checkbox } from '@/components/core/Input';
import { Button } from '@/components/core/Button';
import { LayoutStack } from '@/components/core/Layout';
import { SupportingText, VisuallyHidden } from '@/components/core/Typography';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import {
  canLinkSiteVariable,
  siteVariableContext,
  siteVariableHref,
  siteVariableLabelKeys,
} from '@/lib/site-variables';

const emptyContext: SiteVariableContext = {
  siteTitle: '',
  siteUrl: '',
  companyName: '',
  legalEmail: '',
  contactEmail: '',
};

declare module '@tiptap/core' {
  interface Storage {
    siteVariable: { context: SiteVariableContext };
  }
}

function SiteVariableView({ editor, node, selected, getPos, updateAttributes }: NodeViewProps) {
  const t = useTranslations('editorCommon.editor.siteVariables');
  const { settings } = useSiteSettings();
  const context = siteVariableContext(settings);
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const key = String(node.attrs.key);
  const valid = isSiteVariableKey(key);
  const value = valid ? resolveSiteVariable(key, context) : '';
  const label = valid ? t(siteVariableLabelKeys[key]) : key;
  useEffect(() => {
    editor.storage.siteVariable.context = context;
  }, [editor, context]);
  const focus = () => editor.view.focus();
  const select = () => {
    const position = getPos();
    if (typeof position === 'number') {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, position)));
    }
  };
  return (
    <NodeViewWrapper as="span" contentEditable={false} data-site-variable={key}>
      <Popover open={open && editor.isEditable} onOpenChange={setOpen} onClose={focus} size="compact">
        <Popover.Target>
          <InlineReference
            label={`${label}: ${value}`}
            description={`${label}: ${value || t('unset')} · ${t('source')}`}
            aria-describedby={descriptionId}
            selected={selected}
            unset={!value}
            tabIndex={selected && editor.isEditable ? 0 : -1}
            onMouseDown={(event) => {
              event.preventDefault();
              select();
            }}
            onClick={() => {
              select();
              if (editor.isEditable) {
                setOpen(true);
              }
            }}
          >
            {value || `${label} · ${t('unset')}`}
          </InlineReference>
        </Popover.Target>
        <Popover.Dropdown aria-label={t('inspect')}>
          <LayoutStack gap="sm">
            <SupportingText>{value || t('unset')}</SupportingText>
            <SupportingText tone="muted">
              {t('source')} · {key}
            </SupportingText>
            <Select
              label={t('change')}
              value={key}
              data={siteVariableKeys.map((item) => ({ value: item, label: t(siteVariableLabelKeys[item]) }))}
              onChange={(next) => {
                if (next !== null && isSiteVariableKey(next)) {
                  updateAttributes({ key: next, linked: canLinkSiteVariable(next) && Boolean(node.attrs.linked) });
                }
              }}
            />
            {canLinkSiteVariable(key) ? (
              <Checkbox
                label={t('linked')}
                checked={Boolean(node.attrs.linked)}
                onChange={(event) => updateAttributes({ linked: event.currentTarget.checked })}
              />
            ) : null}
            <Button
              size="sm"
              emphasis="low"
              onClick={() => {
                const position = getPos();
                if (typeof position !== 'number') {
                  return;
                }
                const transaction = editor.state.tr;
                if (value) {
                  transaction.replaceWith(position, position + node.nodeSize, editor.schema.text(value, node.marks));
                } else {
                  transaction.delete(position, position + node.nodeSize);
                }
                editor.view.dispatch(transaction.scrollIntoView());
                setOpen(false);
                focus();
              }}
            >
              {t('convert')}
            </Button>
          </LayoutStack>
        </Popover.Dropdown>
      </Popover>
      <VisuallyHidden id={descriptionId}>
        {t('source')} · {t('inspect')}
      </VisuallyHidden>
    </NodeViewWrapper>
  );
}

export const SiteVariable = Node.create<Record<string, never>, { context: SiteVariableContext }>({
  name: 'siteVariable',
  group: 'inline',
  inline: true,
  atom: true,
  marks: 'bold italic underline strike code textColor backgroundColor',
  selectable: true,
  addStorage: () => ({ context: emptyContext }),
  addAttributes() {
    return {
      key: {
        default: 'site.title',
        parseHTML: (element) => element.getAttribute('data-site-variable'),
        renderHTML: () => ({}),
      },
      linked: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-linked') === 'true',
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-site-variable]',
        getAttrs: (element) => (isSiteVariableKey(element.getAttribute('data-site-variable') ?? '') ? null : false),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const key = String(node.attrs.key);
    const value = isSiteVariableKey(key)
      ? resolveSiteVariable(key, this.editor?.storage.siteVariable.context ?? this.storage.context)
      : '';
    const span = [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-site-variable': key, 'data-linked': Boolean(node.attrs.linked) }),
      value,
    ] as const;
    const href = node.attrs.linked ? siteVariableHref(key, value) : undefined;
    return href ? ['a', { href }, span] : span;
  },
  renderText({ node }) {
    const key = String(node.attrs.key);
    return isSiteVariableKey(key)
      ? resolveSiteVariable(key, this.editor?.storage.siteVariable.context ?? this.storage.context)
      : '';
  },
  addKeyboardShortcuts() {
    const inspect = () => {
      const selection = this.editor.state.selection;
      if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) {
        return false;
      }
      const dom = this.editor.view.nodeDOM(selection.from);
      const button = dom instanceof HTMLElement ? dom.querySelector('button') : null;
      button?.focus();
      button?.click();
      return true;
    };
    return {
      Enter: inspect,
      Tab: inspect,
      Backspace: () => {
        if (!this.editor.isEditable) {
          return false;
        }
        const { selection } = this.editor.state;
        if (selection instanceof NodeSelection && selection.node.type.name === this.name) {
          return this.editor.commands.deleteSelection();
        }
        const previous = selection.$from.nodeBefore;
        if (!selection.empty || previous?.type.name !== this.name) {
          return false;
        }
        return this.editor.commands.deleteRange({ from: selection.from - previous.nodeSize, to: selection.from });
      },
    };
  },
  addNodeView: () => ReactNodeViewRenderer(SiteVariableView, { as: 'span' }),
});
