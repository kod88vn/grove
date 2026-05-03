/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are forbidden',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: {
      path: ['node_modules', '\\.next', '__tests__'],
    },
    moduleSystems: ['es6', 'cjs'],
    tsPreCompilationDeps: false,
    reporterOptions: {},
  },
}
