import type { setSiteAssetAction, deleteSiteAssetAction } from '@/lib/actions/site-setting';
import type { useUpload } from '@/lib/hooks/useUpload';
/** Shared typed asset transport; UI geometry and upload validation stay with their owners. */
export interface SiteAssetBindings {
  set: typeof setSiteAssetAction;
  remove: typeof deleteSiteAssetAction;
  upload: ReturnType<typeof useUpload>['upload'];
  uploadFile: ReturnType<typeof useUpload>['uploadFile'];
}
