import path from 'node:path';
import { scanAffordancePlacement } from '../scripts/design-system/affordance-policy.mjs';
export const affordancePlacementPlugin = {
  rules: {
    placement: {
      meta: { type: 'problem', schema: [], messages: { placement: '{{summary}}' } },
      create(context) {
        return {
          Program() {
            const file = path
              .relative(context.cwd ?? process.cwd(), context.physicalFilename ?? context.filename)
              .split(path.sep)
              .join('/');
            for (const f of scanAffordancePlacement(file, context.sourceCode.text))
              context.report({
                loc: { line: f.line, column: f.column - 1 },
                messageId: 'placement',
                data: { summary: f.summary },
              });
          },
        };
      },
    },
  },
};
