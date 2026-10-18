import { cleanup } from '@testing-library/react';
import { destroyAnnouncer } from 'react-aria/private/live-announcer/LiveAnnouncer';
import { afterEach } from 'vitest';

// React Aria retains a document singleton between files in the shared DOM runtime.
afterEach(() => {
  cleanup();
  destroyAnnouncer();
});
