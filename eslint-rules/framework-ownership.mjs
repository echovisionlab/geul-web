import path from 'node:path';
import { scanFrameworkOwnership } from '../scripts/design-system/framework-policy.mjs';
export const frameworkOwnershipPlugin = {
  rules: {
    'no-escape': {
      meta: { type: 'problem', schema: [], messages: { ownership: '{{summary}}' } },
      create(context) {
        return {
          Program() {
            const root = context.cwd ?? process.cwd(),
              file = path
                .relative(root, context.physicalFilename ?? context.filename)
                .split(path.sep)
                .join('/');
            for (const f of scanFrameworkOwnership(file, context.sourceCode.text, { root }))
              if (f.severity === 'error')
                context.report({
                  loc: { line: f.line, column: f.column - 1 },
                  messageId: 'ownership',
                  data: { summary: f.summary },
                });
          },
        };
      },
    },
  },
};
