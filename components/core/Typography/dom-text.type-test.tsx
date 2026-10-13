import { applyTextPresentation } from './dom-text';
declare const text: HTMLElement;
applyTextPresentation(text, { size: 'xs', tone: 'muted', weight: 'strong' });
// @ts-expect-error Authored hydration cannot create a second typography palette.
applyTextPresentation(text, { color: 'red' });
// @ts-expect-error Typed spreads cannot escape the same Core presentation contract.
applyTextPresentation(text, { ...{ style: { padding: 14 } } });
// @ts-expect-error Physical font sizes are not a public Core choice.
applyTextPresentation(text, { size: 11 });
