import { createEmailPreviewHandler } from '../scripts/design-system/email-preview-handler.mjs';

const handlePreview = createEmailPreviewHandler();

export default function emailPreviewMiddleware(router) {
  router.use((request, response, next) => {
    void handlePreview(request, response).then((handled) => {
      if (!handled) next();
    }, next);
  });
}
