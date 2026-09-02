/**
 * Arrow conversion extension for native TipTap editors.
 *
 * Converts ASCII arrow sequences to Unicode characters:
 * - -> to →
 * - <- to ←
 * - => to ⇒
 * - <=> to ⇔
 * - != to ≠
 * - >= to ≥
 * - <= to ≤ (but not <=>)
 */
import { InputRule } from '@tiptap/core';
import { createTiptapExtension, type TiptapExtensionInstance } from '@/lib/editor/extensions/tiptap';

interface ArrowConversion {
  find: RegExp;
  replace: string;
  preserveTrailingCharacter?: boolean;
}

export const ArrowConversionExtension: TiptapExtensionInstance = createTiptapExtension({
  name: 'arrowConversion',
  addInputRules() {
    return ARROW_CONVERSIONS.map(
      ({ find, replace, preserveTrailingCharacter = false }) =>
        new InputRule({
          find,
          handler: ({ state, range, match }) => {
            const $from = state.doc.resolve(range.from);
            // ED-17's profile-wide choice: code blocks and inline code retain raw source.
            if (
              $from.parent.type.spec.code ||
              $from.parent.type.name === 'codeBlock' ||
              $from.marks().some((mark) => mark.type.spec.code || mark.type.name === 'code')
            ) {
              return null;
            }

            state.tr.insertText(`${replace}${preserveTrailingCharacter ? (match[1] ?? '') : ''}`, range.from, range.to);
          },
        }),
    );
  },
});

const ARROW_CONVERSIONS: readonly ArrowConversion[] = [
  { find: /<=>$/, replace: '⇔' },
  { find: /->$/, replace: '→' },
  { find: /<-$/, replace: '←' },
  { find: /=>$/, replace: '⇒' },
  { find: /!=$/, replace: '≠' },
  { find: />=$/, replace: '≥' },
  // Delay <= until the following character proves that it is not the prefix of <=>.
  { find: /<=(.)$/, replace: '≤', preserveTrailingCharacter: true },
] as const;
