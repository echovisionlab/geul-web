// Next replaces a 'use server' module with action references in client bundles, so its
// implementation (and the server code it reads, such as process.env) never reaches the
// browser. Storybook bundles modules as-is; mirror Next's boundary with throwing stubs.
// Stories inject local adapters instead of calling server actions.
const directive = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(['"])use server\1/;
const action = /^export\s+async\s+function\s+([A-Za-z_$][\w$]*)/gm;
const otherRuntimeExport = /^export\s+(?!async\s+function\s|type\s|interface\s)/m;

module.exports = function stubServerActions(source) {
  if (!directive.test(source)) {
    return source;
  }
  if (otherRuntimeExport.test(source)) {
    throw new Error(`${this.resourcePath}: a 'use server' module may only export async functions`);
  }
  return [...source.matchAll(action)]
    .map(
      ([, name]) =>
        `export async function ${name}() {\n  throw new Error('${name} is a server action; inject an adapter in the story.');\n}\n`,
    )
    .join('');
};
