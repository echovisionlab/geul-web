import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyEditorColorStyleChange } from './color-style-utils';

const mockApplyNeutralBlockProps = vi.fn();

vi.mock('../EditorAuthoringMode', () => ({
  resolveEditorAuthoringMode: () => ({
    allowNeutralBlockEdits: true,
    allowLocalizedBlockEdits: true,
    applyNeutralBlockProps: mockApplyNeutralBlockProps,
  }),
}));

afterEach(() => {
  mockApplyNeutralBlockProps.mockReset();
});

describe('applyEditorColorStyleChange', () => {
  it('adds inline styles for non-default colors without rewriting block props', () => {
    const addStyles = vi.fn();
    const removeStyles = vi.fn();
    const updateBlock = vi.fn();

    applyEditorColorStyleChange(
      {
        getSelection: () => ({
          blocks: [{ id: 'paragraph-1', props: { textColor: 'default' } }],
        }),
        getTextCursorPosition: () => ({
          block: { id: 'paragraph-1', props: { textColor: 'default' } },
        }),
        addStyles,
        removeStyles,
        updateBlock,
      },
      'textColor',
      'purple',
    );

    expect(addStyles).toHaveBeenCalledWith({ textColor: 'purple' });
    expect(removeStyles).not.toHaveBeenCalled();
    expect(updateBlock).not.toHaveBeenCalled();
    expect(mockApplyNeutralBlockProps).not.toHaveBeenCalled();
  });

  it('resets matching block props to default when clearing a whole-paragraph color', () => {
    const block = { id: 'paragraph-1', props: { textColor: 'purple' } };
    const addStyles = vi.fn();
    const removeStyles = vi.fn();
    const updateBlock = vi.fn();

    applyEditorColorStyleChange(
      {
        getSelection: () => ({ blocks: [block] }),
        getTextCursorPosition: () => ({ block }),
        addStyles,
        removeStyles,
        updateBlock,
      },
      'textColor',
      'default',
    );

    expect(removeStyles).toHaveBeenCalledWith({ textColor: 'default' });
    expect(addStyles).not.toHaveBeenCalled();
    expect(updateBlock).toHaveBeenCalledWith(block, {
      props: { textColor: 'default' },
    });
    expect(mockApplyNeutralBlockProps).toHaveBeenCalledWith('paragraph-1', {
      textColor: 'default',
    });
  });
});
