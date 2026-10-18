import { ProcessingOverlay } from './ProcessingOverlay';
const named = <ProcessingOverlay progress={{ value: null, 'aria-label': 'Processing media', title: 'Processing' }} />;
// @ts-expect-error The progress slot consumes the same required naming contract.
const unnamed = <ProcessingOverlay progress={{ value: null, title: 'Processing' }} />;
// @ts-expect-error The progress slot does not reopen appearance overrides.
const styled = <ProcessingOverlay progress={{ value: 30, 'aria-label': 'Processing', style: { background: 'red' } }} />;
void [named, unnamed, styled];
