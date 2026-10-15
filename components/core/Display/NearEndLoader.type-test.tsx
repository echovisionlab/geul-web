import { NearEndLoader, type NearEndLoaderProps } from './NearEndLoader';

const props: NearEndLoaderProps = {
  pageKey: 'next-cursor',
  resetKey: 'query',
  onLoad: async () => {},
  labels: { load: 'Continue', loading: 'Loading', end: 'End', retry: 'Try again', failed: 'Load failed' },
};
<NearEndLoader {...props} />;
// @ts-expect-error Loading must be awaited by the shared request latch.
<NearEndLoader {...props} onLoad={() => {}} />;
// @ts-expect-error Feature-local styles cannot override the owned compact command.
<NearEndLoader {...props} style={{ padding: 48 }} />;
// @ts-expect-error User-facing status and command names are required.
<NearEndLoader {...props} labels={{ load: 'Continue' }} />;
