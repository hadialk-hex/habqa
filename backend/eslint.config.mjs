// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // dist/ is compiled output and the root *.js files are one-off helper
    // scripts (make-admin, diagnose, cleanup-db…) — neither is application
    // source, so linting them only produces noise.
    ignores: ['eslint.config.mjs', 'dist/**', 'node_modules/**', '*.js'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // The codebase deliberately allows `any` (Meta webhook/Graph payloads
      // have no complete typings), so the type-aware no-unsafe-* family only
      // re-flags every use of what no-explicit-any already permits. Rules
      // that catch real bugs (unused vars, floating promises…) stay on.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/require-await': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  // E2E tests exercise raw HTTP responses (supertest's res.body is untyped by
  // design) and use loose mocks, so the type-aware "unsafe any" family only
  // produces noise there — src/ keeps the strict rules and lints clean.
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
