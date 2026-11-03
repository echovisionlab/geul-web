import { PageLoader, type PageLoaderProps } from './index';

<PageLoader contrast="standard" />;
<PageLoader contrast="inverse" placement="flow" />;
// @ts-expect-error Site callers use the same closed contrast choice as Core.
<PageLoader contrast="image" />;
const styleBypass = { style: { color: 'white' } };
// @ts-expect-error Typed spreads cannot bypass the Core contrast contract.
<PageLoader {...styleBypass} />;
// @ts-expect-error Feature classes cannot replace the contrast API.
const classBypass: PageLoaderProps = { className: 'inverse' };
// @ts-expect-error Arbitrary colors cannot replace the contrast API.
<PageLoader color="white" />;
void classBypass;
