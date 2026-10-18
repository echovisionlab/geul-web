// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { PageSectionPreinsertDialog, type ConfiguredSectionType } from './PageSectionPreinsertDialog';

vi.mock('next-intl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl')>()),
  useTranslations: () => (key: string) => key,
}));

function setup(type: ConfiguredSectionType) {
  const onCancel = vi.fn();
  const onInsert = vi.fn();
  return {
    onCancel,
    onInsert,
    ...render(
      <PageSectionPreinsertDialog
        type={type}
        title={type}
        formOptions={[{ value: 'form-published', label: 'Published Form' }]}
        formsLoading={false}
        onCancel={onCancel}
        onInsert={onInsert}
      />,
    ),
  };
}

describe('Page section pre-insert configuration', () => {
  it('cancels without inserting a durable Block', async () => {
    const { user, onCancel, onInsert } = setup('external-video');
    await user.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it.each([
    ['external-video', 'URL', 'not-a-uri', ' https://video.example/watch/1 ', { url: 'https://video.example/watch/1' }],
    [
      'embed',
      'embed.urlLabel',
      'https://user:password@embed.example',
      ' https://embed.example/app ',
      { uri: 'https://embed.example/app' },
    ],
  ] as const)(
    'gates %s insertion and stores the trimmed configured URL exactly once',
    async (type, label, invalid, valid, props) => {
      const { user, onInsert } = setup(type);
      const input = screen.getByRole('textbox', { name: label });
      const confirm = screen.getByRole('button', { name: 'add' });
      expect(confirm).toBeDisabled();
      await user.type(input, invalid);
      expect(confirm).toBeDisabled();
      await user.click(confirm);
      expect(onInsert).not.toHaveBeenCalled();
      await user.clear(input);
      await user.type(input, valid);
      expect(confirm).toBeEnabled();
      await user.click(confirm);
      expect(onInsert).toHaveBeenCalledExactlyOnceWith(type, props);
    },
  );

  it('inserts a Form exactly once only after a published Form is selected', async () => {
    const { user, onInsert } = setup('form');
    const confirm = screen.getByRole('button', { name: 'add' });
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole('combobox', { name: 'blockEditor.labels.selectForm' }));
    await user.click(await screen.findByRole('option', { name: 'Published Form' }));
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onInsert).toHaveBeenCalledExactlyOnceWith('form', { formId: 'form-published' });
  });
});
