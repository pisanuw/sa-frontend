import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  // vendor/ holds the Arboretum submodule, which follows its own lint rules.
  globalIgnores(['dist', 'vendor']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // About 85 existing `any`s; typing them is tracked cleanup, so report without failing CI.
      '@typescript-eslint/no-explicit-any': 'warn',
      // `_name` marks a deliberately unused value, and `{ drop, ...rest }` is how props are
      // kept off DOM elements.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Only affects hot reload during development.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
])
