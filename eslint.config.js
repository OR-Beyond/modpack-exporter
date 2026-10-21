import svelte from 'eslint-plugin-svelte';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['node_modules/**', 'dist/**', '.vite/**', 'build/**'] },
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.svelte.ts', '**/*.mts', '**/*.cts'],
    languageOptions: { parser: tsParser },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: { parser: tsParser },
    },
  },
  {
    files: ['src/**/*.{ts,svelte}'],
    rules: {
      'no-restricted-globals': ['error', 'Bun'],
      'no-restricted-imports': ['error', { patterns: ['bun', 'bun:*'] }],
      'svelte/prefer-svelte-reactivity': 'off',
      'svelte/no-useless-mustaches': 'off',
    },
  },
];
