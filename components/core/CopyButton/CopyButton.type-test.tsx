import { CopyButton } from './CopyButton';

<CopyButton value="token" label="Copy token" copiedLabel="Copied" />;
<CopyButton value={() => 'lazy'} label="Copy" copiedLabel="Copied" size="sm" disabled data-testid="copy" />;
// @ts-expect-error The confirmation text is required so success is announced in the product locale.
<CopyButton value="token" label="Copy token" />;
// @ts-expect-error The accessible name is required.
<CopyButton value="token" copiedLabel="Copied" />;
// @ts-expect-error Core owns the copy and confirmation glyphs.
<CopyButton value="token" label="Copy" copiedLabel="Copied">
  <span />
</CopyButton>;
// @ts-expect-error Core owns the idle and confirmed tones.
<CopyButton value="token" label="Copy" copiedLabel="Copied" tone="accent" />;
// @ts-expect-error Visual overrides remain closed.
<CopyButton value="token" label="Copy" copiedLabel="Copied" className="x" />;
// @ts-expect-error Spreads cannot reopen style overrides.
<CopyButton value="token" label="Copy" copiedLabel="Copied" {...{ style: { color: 'red' } }} />;
