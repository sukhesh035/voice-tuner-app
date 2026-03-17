import nx from '@nx/eslint-plugin';

export default [
  // Nx base config — registers the @nx plugin and ignores .nx/
  ...nx.configs['flat/base'],

  // Nx TypeScript config — applies @typescript-eslint/recommended to .ts files
  ...nx.configs['flat/typescript'],

  // Nx Angular config — applies angular-eslint recommended to .ts files
  ...nx.configs['flat/angular'],

  // Nx Angular template config — applies angular-eslint template rules to .html files
  ...nx.configs['flat/angular-template'],

  // ── Workspace rule overrides ──────────────────────────────────────────────

  // TypeScript files
  {
    files: ['**/*.ts'],
    rules: {
      // Keep warnings actionable — allow console.log in Node handlers
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'prefer-const': 'error',

      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Allow empty arrow functions — used for intentional fire-and-forget
      // .catch(() => {}) patterns throughout the codebase.
      '@typescript-eslint/no-empty-function': [
        'error',
        { allow: ['arrowFunctions'] },
      ],

      // Allow empty catch blocks — used for safe-access wrappers (e.g.
      // localStorage try/catch in shared-utils).
      'no-empty': ['error', { allowEmptyCatch: true }],

      // The codebase uses constructor injection throughout; migrating to
      // inject() is a separate effort tracked outside ESLint.
      '@angular-eslint/prefer-inject': 'off',

      // Selectors — only enforce on Angular projects (backend-api has no
      // components so these rules are harmless no-ops there).
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },

  // Angular templates (.html + inline templates extracted by the processor)
  {
    files: ['**/*.html'],
    rules: {
      // The app uses *ngIf/*ngFor throughout; migrating to @if/@for control
      // flow is a separate effort.
      '@angular-eslint/template/prefer-control-flow': 'off',

      // Accessibility: downgrade to warnings so they don't block CI but
      // remain visible for incremental fixes.
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
      '@angular-eslint/template/label-has-associated-control': 'warn',
    },
  },

  // Loosen rules for tests
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Global ignores
  {
    ignores: [
      'node_modules/',
      'dist/',
      'tmp/',
      '**/generated/**',
      '**/ios/**',
      '**/android/**',
      '**/.angular/**',
    ],
  },
];
