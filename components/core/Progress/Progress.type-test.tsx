import { Progress } from './Progress';

const named = <Progress value={25} aria-label="Uploading field recording" />;
const related = <Progress value={null} aria-labelledby="recording-upload-label" />;
const compact = (
  <Progress value={null} title="Preparing media" status="Reading file" contrast="image" aria-label="Upload recording" />
);
// @ts-expect-error A visible title does not replace the explicit accessible name.
const unlabelledTitle = <Progress value={null} title="Preparing media" />;
// @ts-expect-error Contrast is a named surface contract.
const customContrast = <Progress value={25} aria-label="Uploading" contrast="blue" />;
// @ts-expect-error A meaningful progress indicator requires a name.
const unnamed = <Progress value={25} />;
// @ts-expect-error The accessible name has one explicit authority.
const ambiguous = <Progress value={25} aria-label="Uploading" aria-labelledby="other-task" />;
void [named, related, compact, unlabelledTitle, customContrast, unnamed, ambiguous];
