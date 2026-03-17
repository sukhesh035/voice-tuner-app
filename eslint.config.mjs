import nx from '@nx/eslint-plugin';

// Root ESLint flat config for the workspace. This intentionally builds on
// @nx/eslint-plugin's recommended baseline and applies a few pragmatic rules
// for TypeScript/JS projects across the monorepo.

export default [
  // Nx recommended config (handles many workspace / ts settings)
  nx.configs['recommended'],

  // JS/TS generic rules
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
      // keep import ordering readable
      'import/order': ['warn', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        alphabetize: { order: 'asc', caseInsensitive: true }
      }],
    },
  },

  // TypeScript-specific rules (parser provided by workspace deps)
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.base.json', './tsconfig.json'],
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true, allowTypedFunctionExpressions: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Loosen a few rules for tests
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'test/**', 'tests/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
