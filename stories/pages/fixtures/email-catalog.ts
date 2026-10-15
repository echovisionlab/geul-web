import type { AdminEmailLayoutsPageBindings } from '@/features/admin/email-layout/EmailLayoutsPage';
import type { AdminEmailTemplatesPageBindings } from '@/features/admin/email-template/EmailTemplatesPage';
import type { EmailLayout } from '@/lib/queries/email-layout';
import type { EmailTemplateListItem } from '@/lib/actions/email-template';
import { pageRows } from './paginated';
export type EmailCatalogState = 'ready' | 'empty' | 'failed' | 'pending' | 'action-failed';
const date = new Date('2026-10-01T00:00:00Z');
export function emailCatalogFixture(state: EmailCatalogState): {
  layouts: AdminEmailLayoutsPageBindings;
  templates: AdminEmailTemplatesPageBindings;
} {
  let layouts: EmailLayout[] =
    state === 'empty'
      ? []
      : [
          {
            id: 'local-layout',
            name: 'Editorial mail',
            key: 'editorial',
            htmlContent: '<html><body><main>{{content}}</main></body></html>',
            campaignCount: 1,
            templateCount: 2,
            deliveryRunCount: 0,
            createdAt: date,
            updatedAt: date,
          },
          {
            id: 'local-unused-layout',
            name: 'Studio announcement',
            key: 'studio',
            htmlContent: '<html><body>{{content}}</body></html>',
            campaignCount: 0,
            templateCount: 0,
            deliveryRunCount: 0,
            createdAt: date,
            updatedAt: date,
          },
        ];
  let templates: EmailTemplateListItem[] =
    state === 'empty'
      ? []
      : [
          {
            id: 'local-template',
            key: 'studio_news',
            name: 'Studio news',
            subject: 'Night Signals · October',
            isSystem: false,
            isActive: true,
            deliveryRunCount: 0,
            createdAt: date,
            layoutId: 'local-layout',
          },
          {
            id: 'local-system-template',
            key: 'login_code',
            name: 'Login code',
            subject: 'Your sign-in code',
            isSystem: true,
            isActive: true,
            eventKey: 'login_code',
            deliveryRunCount: 3,
            createdAt: date,
          },
        ];
  let mappings = [{ event: 'login_code', templateId: 'local-system-template', templateName: 'Login code' }];
  const gate = async () => {
    if (state === 'pending') {
      await new Promise(() => {});
    }
    if (state === 'failed') {
      throw new Error('Local email catalog unavailable');
    }
  };
  const failure = () => (state === 'action-failed' ? { error: 'Local email action failed' } : null);
  return {
    layouts: {
      listEmailLayouts: async (input = {}) => {
        await gate();
        return pageRows(layouts, input, (row) => `${row.name} ${row.key}`);
      },
      previewEmailLayout: async (_id, content) => ({
        html: `<html><body><main>${content ?? '<h1>Night Signals</h1><p>Studio announcement</p>'}</main></body></html>`,
      }),
      createEmailLayoutAction: async (input) => {
        const error = failure();
        if (error) {
          return error;
        }
        const id = `local-layout-${layouts.length + 1}`;
        layouts = [
          ...layouts,
          { ...input, id, campaignCount: 0, templateCount: 0, deliveryRunCount: 0, createdAt: date },
        ];
        return { data: { id } };
      },
      deleteEmailLayoutAction: async (id) => {
        const error = failure();
        if (error) {
          return error;
        }
        const row = layouts.find((row) => row.id === id);
        if (row && row.campaignCount + row.templateCount + row.deliveryRunCount > 0) {
          return { error: 'Local layout is referenced', errorCode: 'FAILED_PRECONDITION' };
        }
        layouts = layouts.filter((row) => row.id !== id);
        return { success: true };
      },
    },
    templates: {
      listEmailTemplatesAdminAction: async (input) => {
        await gate();
        return pageRows(templates, input, (row) => `${row.name} ${row.key} ${row.subject}`);
      },
      listEmailEventMappingsAction: async () => {
        await gate();
        return state === 'empty' ? [] : mappings;
      },
      updateEmailTemplateEventMappingAction: async (event, templateId) => {
        const error = failure();
        if (error) {
          return error;
        }
        mappings = mappings.map((row) =>
          row.event === event
            ? {
                ...row,
                templateId: templateId ?? '',
                templateName: templates.find((template) => template.id === templateId)?.name ?? '',
              }
            : row,
        );
        return { success: true };
      },
      createEmailTemplateAction: async (input) => {
        const error = failure();
        if (error) {
          return error;
        }
        const id = `local-template-${templates.length + 1}`;
        templates = [
          ...templates,
          { ...input, id, isSystem: false, isActive: true, deliveryRunCount: 0, createdAt: date },
        ];
        return { data: { id } };
      },
      deleteEmailTemplateAction: async (id) => {
        const error = failure();
        if (error) {
          return error;
        }
        templates = templates.filter((row) => row.id !== id);
        return { success: true };
      },
    },
  };
}
