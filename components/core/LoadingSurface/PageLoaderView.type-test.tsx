import { PageLoaderView, type PageLoaderViewContrast } from './index';
import type { PageLoaderViewContrast as PublicContrast } from '../index';

const fill = <PageLoaderView imageAlt="Loading page" message="Connecting" />;
const flow = <PageLoaderView imageAlt="Loading page" message="Loading content" placement="flow" minHeight={160} />;
// @ts-expect-error Visible text is required independently of the accessible name.
const missingMessage = <PageLoaderView imageAlt="Loading page" />;
// @ts-expect-error The accessible name is required independently of visible text.
const missingName = <PageLoaderView message="Loading" />;
// @ts-expect-error Placement is limited to fill or flow.
const invalidPlacement = <PageLoaderView imageAlt="Loading page" message="Loading" placement="inline" />;

const contrast: PublicContrast = 'inverse' satisfies PageLoaderViewContrast;
const inverse = <PageLoaderView imageAlt="Loading page" message="Loading" contrast={contrast} />;
// @ts-expect-error Contrast is a closed semantic choice, not a Text contrast or color.
const invalidContrast = <PageLoaderView imageAlt="Loading page" message="Loading" contrast="image" />;
const styleBypass = { style: { color: 'red' } };
// @ts-expect-error Typed spreads cannot override Core contrast with inline styles.
const styled = <PageLoaderView imageAlt="Loading page" message="Loading" {...styleBypass} />;
const classBypass = { className: 'feature-color' };
// @ts-expect-error Typed spreads cannot override Core contrast with feature classes.
const classed = <PageLoaderView imageAlt="Loading page" message="Loading" {...classBypass} />;
// @ts-expect-error Arbitrary colors are not part of the loader contract.
const colored = <PageLoaderView imageAlt="Loading page" message="Loading" color="red" />;

void [fill, flow, inverse, missingMessage, missingName, invalidPlacement, invalidContrast, styled, classed, colored];
