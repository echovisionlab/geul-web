import { createTranslator } from 'next-intl';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';

interface ListPlayContext {
  canvasElement: HTMLElement;
  globals: Record<string, unknown>;
}

/** Exercise actual list controls with the same translated names as production. */
export async function verifyAdminListControls({ canvasElement, globals }: ListPlayContext) {
  const locale = normalizeLocale(typeof globals.locale === 'string' ? globals.locale : '') ?? DEFAULT_LOCALE;
  const { default: messages } = await import(`../../messages/${locale}.json`);
  const t = createTranslator({ locale, messages, namespace: 'dataTable' });
  const common = createTranslator({ locale, messages, namespace: 'common' });
  const canvas = within(canvasElement);
  await expect(canvas.getByRole('heading', { level: 1 })).toHaveAccessibleName();
  const search = await canvas.findByRole('searchbox');
  await expect(search).toHaveAccessibleName();
  for (const checkbox of canvas.queryAllByRole('checkbox')) {
    await expect(checkbox).toHaveAccessibleName();
  }

  // Production filter/sort controls mount through next/dynamic independently of search.
  const filter = await canvas.findByRole('button', { name: t('filter.button') });
  await userEvent.click(filter);
  const filterDialog = await within(document.body).findByRole('dialog', { name: t('filter.drawerTitle') });
  const filterScope = within(filterDialog);
  const fieldCheckboxes = filterScope.getAllByRole('checkbox');
  for (const checkbox of fieldCheckboxes) {
    await expect(checkbox).toHaveAccessibleName();
  }
  await userEvent.click(fieldCheckboxes[0]);
  await expect(filterScope.getByRole('radiogroup', { name: t('filter.operator') })).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(filter).toHaveFocus());

  const sort = await canvas.findByRole('button', { name: t('sort.button') });
  await userEvent.click(sort);
  const sortDialog = await within(document.body).findByRole('dialog', { name: t('sort.button') });
  const sortScope = within(sortDialog);
  const sortFields = sortScope.getAllByRole('checkbox');
  for (const checkbox of sortFields) {
    await expect(checkbox).toHaveAccessibleName();
  }
  await userEvent.click(sortFields[0]);
  await expect(sortFields[0]).toBeChecked();
  const fieldLabel = sortFields[0].getAttribute('aria-label')!;
  for (const direction of sortScope.getAllByRole('button', {
    name: t('sort.aria.toggleDirection', { label: fieldLabel }),
  })) {
    await expect(direction).toHaveAccessibleDescription(t('sort.aria.directionDescending'));
  }
  const direction = sortScope.getAllByRole('button', {
    name: t('sort.aria.toggleDirection', { label: fieldLabel }),
  })[0];
  await userEvent.click(direction);
  await expect(direction).toHaveAccessibleDescription(t('sort.aria.directionAscending'));
  await userEvent.click(direction);
  await expect(direction).toHaveAccessibleDescription(t('sort.aria.directionDescending'));
  const apply = sortScope.queryByRole('button', { name: common('actions.apply') });
  if (apply) {
    await expect(apply).toBeEnabled();
    await userEvent.click(apply);
  } else {
    await userEvent.keyboard('{Escape}');
  }
  await waitFor(() => expect(sort).toHaveFocus());
}
