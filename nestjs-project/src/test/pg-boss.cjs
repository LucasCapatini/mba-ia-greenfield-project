// Shim usado SOMENTE pelo Jest (moduleNameMapper "^pg-boss$" em package.json e test/jest-e2e.json).
//
// O pg-boss 12 é publicado apenas como ESM. Em produção o Nest (CommonJS) o carrega pelo
// `require(esm)` nativo do Node ≥ 22.12, mas o runtime de módulos do Jest (CJS, sem
// --experimental-vm-modules) não sabe avaliar `import` dentro de node_modules.
//
// Dentro da sandbox do Jest, `require('node:module').createRequire` é a versão PATCHED do
// jest-runtime (volta para o registro do Jest). `process.getBuiltinModule` (Node ≥ 22.3) entrega
// o builtin genuíno, cujo `createRequire` é o do Node e carrega o pacote real fora do Jest —
// exatamente como a aplicação faz.
const nodeModule =
  typeof process.getBuiltinModule === 'function'
    ? process.getBuiltinModule('node:module')
    : require('node:module');

module.exports = nodeModule.createRequire(__filename)('pg-boss');
