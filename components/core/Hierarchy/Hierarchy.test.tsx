// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { Hierarchy, HierarchyIndent } from './Hierarchy';
import { Disclosure } from '../Disclosure';
import { TextButton } from '../TextButton';

const container = document.createElement('div');
document.body.append(container);
const root = createRoot(container);
afterEach(() => act(() => root.render(null)));
afterAll(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Hierarchy contract', () => {
  it('shares named spacing across nested owners without replacing title alignment', () => {
    act(() =>
      root.render(
        <Hierarchy spacing="md">
          <Disclosure label="Parent" density="compact" defaultOpened>
            <Disclosure nested label="Child" density="compact" defaultOpened>
              <Hierarchy>
                <HierarchyIndent>Grandchild</HierarchyIndent>
              </Hierarchy>
            </Disclosure>
            <TextButton nested href="#child" density="chrome">
              Destination
            </TextButton>
          </Disclosure>
        </Hierarchy>,
      ),
    );
    for (const el of container.querySelectorAll<HTMLElement>('[data-disclosure], [data-geul-hierarchy-indent], a')) {
      expect(el.style.getPropertyValue('--_hierarchy-step')).toBe('var(--geul-spacing-md)');
    }
    const disclosures = container.querySelectorAll('[data-disclosure]');
    expect(disclosures[0].hasAttribute('data-geul-hierarchy-nested')).toBe(false);
    expect(disclosures[1].hasAttribute('data-geul-hierarchy-nested')).toBe(true);
    expect(disclosures[1].getAttribute('data-content-indent')).toBe('label');
    expect(container.querySelector('a')?.hasAttribute('data-geul-hierarchy-nested')).toBe(true);
  });

  it('owns the default role and strips untyped presentation/state overrides', () => {
    const escape = { style: { paddingLeft: 99 }, className: 'feature-indent', 'data-geul-hierarchy-indent': 'none' };
    act(() => root.render(<HierarchyIndent {...(escape as {})}>Child</HierarchyIndent>));
    const el = container.querySelector<HTMLElement>('[data-geul-hierarchy-indent]')!;
    expect(el.style.getPropertyValue('--_hierarchy-step')).toBe('var(--geul-hierarchy-step)');
    expect(el.style.paddingLeft).toBe('');
    expect(el.className).not.toContain('feature-indent');
    expect(el.getAttribute('data-geul-hierarchy-indent')).toBe('content');
  });
});
