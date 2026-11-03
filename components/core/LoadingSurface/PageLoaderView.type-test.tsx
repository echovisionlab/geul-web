import { PageLoaderView } from './PageLoaderView';

const fill = <PageLoaderView imageAlt="Loading page" message="Connecting" />;
const flow = <PageLoaderView imageAlt="Loading page" message="Loading content" placement="flow" minHeight={160} />;
// @ts-expect-error Visible text is required independently of the accessible name.
const missingMessage = <PageLoaderView imageAlt="Loading page" />;
// @ts-expect-error The accessible name is required independently of visible text.
const missingName = <PageLoaderView message="Loading" />;
// @ts-expect-error Placement is limited to fill or flow.
const invalidPlacement = <PageLoaderView imageAlt="Loading page" message="Loading" placement="inline" />;

void [fill, flow, missingMessage, missingName, invalidPlacement];
