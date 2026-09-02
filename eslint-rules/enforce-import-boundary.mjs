import path from 'node:path';

const RESTRICTED_RUNTIME_PACKAGE_ROOTS = [
  'next-intl',
  'next/navigation',
  '@mantine/notifications',
  '@tanstack/react-query',
  'next-auth',
];

const FEATURE_UI_RESTRICTED_ALIAS_ROOTS = ['@/app', '@/features', '@/hooks', '@/i18n', '@/lib', '@/messages'];

function isWithinImportNamespace(source, namespace) {
  return source === namespace || source.startsWith(`${namespace}/`);
}

function isRestrictedSource(boundaryKind, source) {
  if (
    RESTRICTED_RUNTIME_PACKAGE_ROOTS.some((namespace) => isWithinImportNamespace(source, namespace)) ||
    isWithinImportNamespace(source, '@echovisionlab')
  ) {
    return true;
  }

  if (boundaryKind === 'core') {
    return source.startsWith('@/');
  }

  return (
    boundaryKind === 'feature-ui' &&
    FEATURE_UI_RESTRICTED_ALIAS_ROOTS.some((namespace) => isWithinImportNamespace(source, namespace))
  );
}

/** @type {import('eslint').Rule.RuleModule} */
export const enforceImportBoundaryRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent imports from escaping a declared UI architecture boundary.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          boundary: { enum: ['core', 'feature-ui'] },
        },
        required: ['boundary'],
        additionalProperties: false,
      },
    ],
    messages: {
      escape:
        'Relative import "{{source}}" escapes the {{boundary}} boundary. Move orchestration outside the boundary or pass data through props.',
      restricted:
        '{{boundary}} must not import "{{source}}". Move orchestration outside this UI boundary and pass resolved values through props.',
    },
  },
  create(context) {
    const filename = context.physicalFilename ?? context.filename;
    const boundaryKind = context.options[0]?.boundary;
    const workspaceRoot = process.cwd();
    const relativeFilename = path.relative(workspaceRoot, filename);
    const filenameSegments = relativeFilename.split(path.sep);
    let boundaryRoot = null;

    if (boundaryKind === 'core') {
      boundaryRoot = path.join(workspaceRoot, 'components', 'core');
    } else if (boundaryKind === 'feature-ui') {
      const featuresIndex = filenameSegments.indexOf('features');
      const uiIndex = filenameSegments.indexOf('ui', featuresIndex + 1);
      if (featuresIndex >= 0 && uiIndex > featuresIndex) {
        boundaryRoot = path.join(workspaceRoot, ...filenameSegments.slice(0, uiIndex + 1));
      }
    }

    function checkSource(node, sourceNode) {
      const source = sourceNode?.value;
      if (typeof source !== 'string') {
        return;
      }

      if (isRestrictedSource(boundaryKind, source)) {
        context.report({
          node,
          messageId: 'restricted',
          data: {
            source,
            boundary: boundaryKind === 'core' ? 'Core UI' : 'Feature UI',
          },
        });
        return;
      }

      if (!boundaryRoot || !(source === '..' || source.startsWith('../') || source.startsWith('./'))) {
        return;
      }

      const targetPath = path.resolve(path.dirname(filename), source);
      const relativeTarget = path.relative(boundaryRoot, targetPath);
      if (relativeTarget === '..' || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
        context.report({
          node,
          messageId: 'escape',
          data: {
            source,
            boundary: boundaryKind === 'core' ? 'Core UI' : 'Feature UI subtree',
          },
        });
      }
    }

    return {
      ImportDeclaration(node) {
        checkSource(node, node.source);
      },
      ExportNamedDeclaration(node) {
        checkSource(node, node.source);
      },
      ExportAllDeclaration(node) {
        checkSource(node, node.source);
      },
      ImportExpression(node) {
        checkSource(node, node.source);
      },
      TSImportType(node) {
        checkSource(node, node.source);
      },
      TSImportEqualsDeclaration(node) {
        if (node.moduleReference.type === 'TSExternalModuleReference') {
          checkSource(node, node.moduleReference.expression);
        }
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
          checkSource(node, node.arguments[0]);
        }
      },
    };
  },
};

function getStringJsxAttributeValue(attribute) {
  if (!attribute.value) {
    return null;
  }

  if (attribute.value.type === 'Literal') {
    return typeof attribute.value.value === 'string' ? attribute.value.value : null;
  }

  if (
    attribute.value.type === 'JSXExpressionContainer' &&
    attribute.value.expression.type === 'Literal' &&
    typeof attribute.value.expression.value === 'string'
  ) {
    return attribute.value.expression.value;
  }

  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export const noMantineBoxButtonRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent Mantine Box from bypassing the Core semantic control boundary.',
    },
    schema: [],
    messages: {
      boxButton:
        'Do not render Mantine Box as a button outside Core. Use @/components/core/TextButton, IconButton, Button, or another semantic Core control.',
    },
  },
  create(context) {
    const mantineBoxLocalNames = new Set();
    const mantineNamespaceLocalNames = new Set();

    function isMantineBoxElement(name) {
      if (name.type === 'JSXIdentifier') {
        return mantineBoxLocalNames.has(name.name);
      }

      return (
        name.type === 'JSXMemberExpression' &&
        name.object.type === 'JSXIdentifier' &&
        mantineNamespaceLocalNames.has(name.object.name) &&
        name.property.type === 'JSXIdentifier' &&
        name.property.name === 'Box'
      );
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value !== '@mantine/core') {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'Box'
          ) {
            mantineBoxLocalNames.add(specifier.local.name);
          } else if (specifier.type === 'ImportNamespaceSpecifier') {
            mantineNamespaceLocalNames.add(specifier.local.name);
          }
        }
      },
      JSXOpeningElement(node) {
        if (!isMantineBoxElement(node.name)) {
          return;
        }

        const componentAttribute = node.attributes.find(
          (attribute) =>
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === 'component',
        );

        if (
          componentAttribute?.type === 'JSXAttribute' &&
          getStringJsxAttributeValue(componentAttribute) === 'button'
        ) {
          context.report({ node: componentAttribute, messageId: 'boxButton' });
        }
      },
    };
  },
};

export const importBoundaryPlugin = {
  rules: {
    'enforce-import-boundary': enforceImportBoundaryRule,
    'no-mantine-box-button': noMantineBoxButtonRule,
  },
};
