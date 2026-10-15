import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanResponsiveOwnership } from '../scripts/design-system/responsive-policy.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
export const responsiveOwnershipPlugin = {
  meta: { name: 'geul-responsive-ownership', version: '1.0.0' },
  rules: {
    'no-escape': {
      meta: { type: 'problem', schema: [], messages: { violation: '{{summary}}' } },
      create(context) {
        return {
          Program() {
            const file = path.relative(root, context.filename).split(path.sep).join('/');
            for (const finding of scanResponsiveOwnership(file, context.sourceCode.text))
              context.report({
                loc: { line: finding.line, column: 0 },
                messageId: 'violation',
                data: { summary: finding.summary },
              });
          },
        };
      },
    },
  },
};
