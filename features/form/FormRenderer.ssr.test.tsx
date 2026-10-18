import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildForm } from '@/lib/form/build';
import type { FormSchema } from '@/lib/types/form/schema';
import { TestProviders } from '@/test/TestProviders';
import { FormRenderer } from './FormRenderer';

const singleStep: FormSchema = {
  id: 'single-step-form',
  steps: [
    {
      id: 'submit-step',
      title: 'Submit Step',
      fields: [{ id: 'optional', name: 'optional', type: 'text', label: 'Optional text' }],
    },
  ],
};

const twoSteps: FormSchema = {
  id: 'multi-step-form',
  steps: [
    { id: 'step-1', title: 'Step One', fields: [] },
    { id: 'step-2', title: 'Step Two', fields: [] },
  ],
};

function renderMarkup(schema: FormSchema) {
  return renderToStaticMarkup(
    <TestProviders>
      <FormRenderer form={buildForm(schema)} />
    </TestProviders>,
  );
}

function buttonLabels(markup: string) {
  return Array.from(markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g), ([, inner]) =>
    inner.replace(/<[^>]+>/g, '').trim(),
  );
}

describe('FormRenderer first render', () => {
  it('hides the progress bar when only one step is visible', () => {
    expect(renderMarkup(singleStep)).not.toContain('role="progressbar"');
  });

  it('renders the progress bar for multi-step forms', () => {
    expect(renderMarkup(twoSteps)).toContain('role="progressbar"');
  });

  it('hides the previous button on the first step', () => {
    const labels = buttonLabels(renderMarkup(twoSteps));

    expect(labels).toContain('Next');
    expect(labels).not.toContain('Previous');
  });
});
