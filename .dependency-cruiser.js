export default {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'shared-must-not-depend-upwards',
      severity: 'error',
      from: { path: '^src/shared' },
      to: { path: '^src/(app|features)' },
    },
    {
      name: 'no-cross-feature-dependencies',
      severity: 'error',
      from: { path: '^src/features/([^/]+)' },
      to: {
        path: '^src/features',
        pathNot: '^src/features/$1/',
      },
    },
    {
      name: 'features-are-only-accessible-through-public-api',
      severity: 'error',
      from: { path: '^src/app' },
      to: {
        path: '^src/features',
        pathNot: '^src/features/[^/]+/index\\.tsx?$',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      conditionNames: ['import', 'module', 'browser', 'default'],
      mainFields: ['module', 'main'],
    },
  },
}
