import { Field } from './Field';
<Field layout="inline" label="Language">
  <select />
</Field>;
// @ts-expect-error Shared field layouts are finite.
<Field layout="custom" label="Language">
  <select />
</Field>;
// @ts-expect-error Field styling stays in Core.
<Field layout="inline" label="Language" style={{ gap: 19 }}>
  <select />
</Field>;
