import { ErrorPageView } from './ErrorPageView';

<ErrorPageView
  title="Error"
  actions={[
    { label: 'Retry', onClick: async () => {} },
    { label: 'Home', href: '/' },
  ]}
/>;
// @ts-expect-error Retry commands cannot also navigate.
<ErrorPageView title="Error" actions={[{ label: 'Retry', onClick: async () => {}, href: '/' }]} />;
<ErrorPageView title="Error" actions={[{ label: 'Retry', onClick: async () => 'done' }]} />;
