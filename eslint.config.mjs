import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'class',
          format: ['PascalCase']
        },
        {
          selector: 'memberLike',
          modifiers: ['private', 'static'],
          format: ['UPPER_CASE'],
          leadingUnderscore: 'require'
        },
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require'
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z]',
            match: false
          }
        }
      ],
      '@typescript-eslint/no-empty-function': 'error',
      curly: 'error',
      'dot-notation': 'error',
      'no-caller': 'error',
      'no-console': [
        'error',
        {
          allow: ['debug', 'info', 'time', 'timeEnd', 'trace']
        }
      ],
      'no-debugger': 'error',
      'no-empty': 'error',
      'no-eval': 'error',
      'no-fallthrough': 'error',
      'no-new-wrappers': 'error',
      'no-unused-labels': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'require-await': 'warn',
      radix: 'error',
      eqeqeq: ['error', 'smart'],
      'no-irregular-whitespace': 'error',
      'brace-style': ['error', '1tbs'],
      'no-unused-expressions': [
        'error',
        {
          allowTernary: true
        }
      ],
      'jsdoc/require-param': 0,
      'jsdoc/require-param-description': 0,
      'jsdoc/require-param-type': 0,
      'jsdoc/require-returns': 0,
      'jsdoc/require-returns-type': 0,
      'jsdoc/newline-after-description': 0,
      'jsdoc/no-multi-asterisks': 0,
      'jsdoc/check-tag-names': [
        'error',
        {
          definedTags: ['hidden', 'internal', 'source', 'obsolete', 'warning', 'notimplemented', 'credit', 'typedoc']
        }
      ]
    }
  }
];
