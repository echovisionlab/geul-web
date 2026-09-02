const ts = require('@typescript/tooling');

module.exports = function transpileTypeScript(source) {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      sourceMap: this.sourceMap,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: this.resourcePath,
  });

  this.callback(null, result.outputText, result.sourceMapText ? JSON.parse(result.sourceMapText) : undefined);
};
