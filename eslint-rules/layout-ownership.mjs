import path from 'node:path';
import { scanLayoutOwnership } from '../scripts/design-system/layout-policy.mjs';
export const layoutOwnershipRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { ownership: '{{summary}}' },
    docs: { description: 'Protect Core Layout visual ownership and migrated consumer composition.' },
  },
  create(context) {
    return {
      Program() {
        const root = context.cwd ?? process.cwd();
        const file = path
          .relative(root, context.physicalFilename ?? context.filename)
          .split(path.sep)
          .join('/');
        for (const finding of scanLayoutOwnership(file, context.sourceCode.text, { root })) {
          // Warnings are exposed by CLI. ESLint reports only ownership violations so typed safe forwarding remains possible.
          if (finding.severity !== 'error') continue;
          context.report({
            loc: { line: finding.line, column: finding.column - 1 },
            messageId: 'ownership',
            data: { summary: finding.summary },
          });
        }
      },
    };
  },
};
export const layoutOwnershipPlugin = { rules: { 'no-escape': layoutOwnershipRule } };
