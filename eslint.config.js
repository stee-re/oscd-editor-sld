// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import js from '@eslint/js';
import globals from 'globals';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import eslintPluginTSDoc from 'eslint-plugin-tsdoc';
import stylistic from '@stylistic/eslint-plugin';
import litPlugin from 'eslint-plugin-lit';
import wcPlugin from 'eslint-plugin-wc';
import litA11yPlugin from 'eslint-plugin-lit-a11y';
import importXPlugin from 'eslint-plugin-import-x';
import noOnlyTestsPlugin from 'eslint-plugin-no-only-tests';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: globals.browser,
    },
  },
  ...typescriptEslint.configs['flat/recommended'],
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'doc/', '.rollup.cache/'],
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    plugins: {
      tsdoc: eslintPluginTSDoc,
      '@stylistic': stylistic,
      lit: litPlugin,
      wc: wcPlugin,
      'lit-a11y': litA11yPlugin,
      'import-x': importXPlugin,
      'no-only-tests': noOnlyTestsPlugin,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': [
        'error',
        {
          ignoreRestArgs: true,
        },
      ],

      // Formatting (stylistic)
      '@stylistic/indent': ['error', 2],
      '@stylistic/brace-style': ['error', '1tbs'],
      '@stylistic/arrow-parens': ['error', 'as-needed', { requireForBlockBody: true }],

      // General
      curly: ['error', 'all'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ForInStatement',
          message:
            'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
        },
        {
          selector: 'LabeledStatement',
          message:
            'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
        },
        {
          selector: 'WithStatement',
          message:
            '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
        },
      ],

      // Imports
      'import-x/no-unresolved': ['error', { ignore: ['\\.js$'] }],
      'import-x/extensions': ['error', 'always', { ignorePackages: true }],
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/test/**/*.{html,js,mjs,ts}',
            '**/stories/**/*.{html,js,mjs,ts}',
            '**/demo/**/*.{html,js,mjs,ts}',
            '**/*.config.{html,js,mjs,ts}',
            '**/*.conf.{html,js,mjs,ts}',
          ],
        },
      ],

      // Lit
      'lit/attribute-value-entities': 'error',
      'lit/no-value-attribute': 'error',
      'lit/no-invalid-escape-sequences': 'error',
      'lit/no-legacy-template-syntax': 'error',
      'lit/no-native-attributes': 'error',
      'lit/no-classfield-shadowing': 'error',
      'lit/lifecycle-super': 'error',

      // Lit accessibility
      'lit-a11y/accessible-name': 'error',
      'lit-a11y/alt-text': 'error',
      'lit-a11y/anchor-is-valid': 'error',
      'lit-a11y/aria-activedescendant-has-tabindex': 'error',
      'lit-a11y/aria-attr-valid-value': 'error',
      'lit-a11y/aria-attrs': 'error',
      'lit-a11y/aria-role': 'error',
      'lit-a11y/aria-unsupported-elements': 'error',
      'lit-a11y/autocomplete-valid': 'error',
      'lit-a11y/click-events-have-key-events': 'error',
      'lit-a11y/definition-list': 'error',
      'lit-a11y/heading-hidden': 'error',
      'lit-a11y/iframe-title': 'error',
      'lit-a11y/img-redundant-alt': 'error',
      'lit-a11y/list': 'error',
      'lit-a11y/mouse-events-have-key-events': 'error',
      'lit-a11y/no-access-key': 'error',
      'lit-a11y/no-aria-slot': 'error',
      'lit-a11y/no-autofocus': 'error',
      'lit-a11y/no-distracting-elements': 'error',
      'lit-a11y/no-redundant-role': 'error',
      'lit-a11y/obj-alt': 'error',
      'lit-a11y/role-has-required-aria-attrs': 'error',
      'lit-a11y/role-supports-aria-attr': 'error',
      'lit-a11y/scope': 'error',
      'lit-a11y/tabindex-no-positive': 'error',

      // Tests
      'no-only-tests/no-only-tests': 'error',

      // TSDoc
      'tsdoc/syntax': 'warn',
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx,mts,cts}', 'src/**/*.spec.{ts,tsx,mts,cts}'],
    rules: {
      'import-x/no-extraneous-dependencies': 'off',
      'import-x/no-unresolved': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
    },
  },
];
