// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import type { FormSchema } from '@/lib/types/form/schema';
import { render, screen, within } from '@/test/render';
import { SubmissionDetail } from './SubmissionDetail';

const schema: FormSchema = {
  id: 'form-1',
  steps: [
    {
      id: 'step-1',
      fields: [
        { id: 'field-a', key: 'a', label: 'Name', type: 'text' },
        { id: 'field-b', key: 'b', label: 'Agree', type: 'checkbox' },
      ],
    },
  ],
};

describe('SubmissionDetail.Responses', () => {
  it('lists answers in form-schema order and keeps answers to fields no longer in the schema', () => {
    // Stored answer order differs from the schema; `removed` belongs to a field deleted from the form.
    render(<SubmissionDetail.Responses schema={schema} data={{ b: true, a: 'x', removed: 'kept' }} />);

    const answers = screen.getAllByRole('group');
    expect(answers.map((answer) => answer.getAttribute('aria-label'))).toEqual(['Name', 'Agree', 'removed']);
    expect(within(answers[0]!).getByText('x')).toBeInTheDocument();
    expect(within(answers[1]!).getByRole('img', { name: 'True' })).toBeInTheDocument();
    expect(within(answers[2]!).getByText('kept')).toBeInTheDocument();
  });
});
