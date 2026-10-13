// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { composeStory } from '@storybook/nextjs';
import { coreArgTypes, enhanceCoreArgTypes, literalOptions, representativeStory } from './documentation-contract';

describe('documentation examples and controls', () => {
  it('enriches controls after Storybook infers them from actual story args', () => {
    const story = composeStory(
      {
        args: { tone: 'neutral', emphasis: 'medium', children: 'Save' },
        render: () => createElement('button', { type: 'button' }),
      },
      { title: 'Core/Actions/Button' },
      { argTypesEnhancers: [enhanceCoreArgTypes] },
    );
    expect(story.argTypes.tone?.options).toEqual(['accent', 'neutral', 'positive', 'warning', 'danger']);
    expect(story.argTypes.tone?.control).toEqual({ type: 'select' });
    expect(story.argTypes.emphasis?.table?.defaultValue).toEqual({ summary: "'medium'" });
  });
  it('shows the real Default export before an emphasized first story', () => {
    const stories = [
      { id: 'button--primary', name: 'Primary' },
      { id: 'button--default', name: 'Default' },
    ];
    expect(representativeStory(stories)).toBe(stories[1]);
    expect(representativeStory([stories[0]])).toBe(stories[0]);
    expect(representativeStory([])).toBeUndefined();
  });
  it('uses the real Playground when the component has no Default', () => {
    const states = [
      { id: 'menu--command-dropdown-menu', name: 'Command Dropdown Menu' },
      { id: 'menu--playground', name: 'Playground' },
    ];
    expect(representativeStory(states)).toBe(states[1]);
  });
  it('does not invent choices for aliases, conditions or partially open types', () => {
    expect(literalOptions("'neutral' | 'accent'")).toEqual(['neutral', 'accent']);
    for (const type of ['ButtonSize', "'sm' | string", "'sm' | undefined", 'T extends string ? T : never']) {
      expect(literalOptions(type)).toBeUndefined();
    }
  });
  it('uses source choices without publishing props absent from the story', () => {
    const result = coreArgTypes({ tone: { control: 'text' }, state: { options: ['ready', 'pending'] } }, [
      { name: 'tone', type: "'neutral' | 'accent'", required: false, defaultValue: "'neutral'" },
      { name: 'disabled', type: 'boolean', required: false, defaultValue: 'false' },
    ]);
    expect(result.tone.options).toEqual(['neutral', 'accent']);
    expect(result.tone.control).toEqual({ type: 'select' });
    expect(result.tone.table?.defaultValue).toEqual({ summary: "'neutral'" });
    expect(result).not.toHaveProperty('disabled');
    expect(result.state.options).toEqual(['ready', 'pending']);
  });
  it('preserves explicit fixture options and closes forbidden visual controls', () => {
    const result = coreArgTypes({ emphasis: { options: ['medium', 'low'] }, href: { control: false }, style: {} }, [
      { name: 'emphasis', type: "'strong' | 'medium' | 'low'", required: false },
      { name: 'href', type: 'string', required: false },
      { name: 'style', type: 'never', required: false },
    ]);
    expect(result.emphasis.options).toEqual(['medium', 'low']);
    expect(result.href.control).toBe(false);
    expect(result.style.control).toBe(false);
    expect(result.style.table?.disable).toBe(true);
  });
});
