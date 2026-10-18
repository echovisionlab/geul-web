// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/render';
import { FormBuilder } from './FormBuilder';

const schema = {
  id: 'schema-1',
  steps: [
    {
      id: 'step-1',
      title: 'Localized step',
      fields: [{ id: 'field-1', key: 'message', label: 'Localized field', type: 'text' as const }],
    },
  ],
};

describe('FormBuilder', () => {
  it('hides structure editing controls in translation mode', async () => {
    const { user } = render(<FormBuilder schema={schema} mode="translation" title="Localized form" />);
    await user.click(screen.getByRole('button', { name: /Localized step.*fields/ }));
    expect(screen.queryByRole('button', { name: 'Add Step' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Field' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove (step|field)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Drag (step|field)/ })).not.toBeInTheDocument();
  });

  it('puts editing controls before the preview in keyboard and reading order', () => {
    render(<FormBuilder schema={schema} mode="full" title="Localized form" />);
    const builder = screen.getByRole('heading', { name: 'Form Builder' });
    const preview = screen.getByRole('heading', { name: 'Preview' });
    expect(builder.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows structure editing controls in full mode', async () => {
    const { user } = render(<FormBuilder schema={schema} mode="full" title="Localized form" />);
    await user.click(screen.getByRole('button', { name: /Localized step.*fields/ }));
    expect(screen.getByRole('button', { name: 'Add Step' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove step 1' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Drag (step|field)/ })).toHaveLength(2);
  });
});
