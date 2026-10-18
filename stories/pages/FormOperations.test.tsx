// @vitest-environment node
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { FormSubmissionDetailPageView } from '@/features/form/FormSubmissionDetailPageView';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('@/lib/actions/form', () => ({ deleteFormSubmissionAction: vi.fn() }));

it('renders submission metadata and responses with its delete action', () => {
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <TestProviders>
        <FormSubmissionDetailPageView
          formId="form-1"
          formSchema={{
            id: 'form-1',
            steps: [{ id: 'identity', fields: [{ id: 'name', type: 'text', label: 'Name' }] }],
          }}
          submission={{ id: 'submission-1', formId: 'form-1', data: { name: 'June Han' }, ipAddress: '192.0.2.1' }}
        />
      </TestProviders>
    </QueryClientProvider>,
  );
  expect(markup).toContain('June Han');
  expect(markup).toContain('Metadata');
  expect(markup).toContain('192.0.2.1');
  expect(markup).toMatch(/<button\b[^>]*aria-label="Delete"/);
});
