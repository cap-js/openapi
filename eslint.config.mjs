import js from '@eslint/js';
import globals from 'globals'
/*
export default [
  js.config({
    env: {
      jest: true,
      es6: true,
      node: true,
    },
    parserOptions: {
      ecmaVersion: 'latest',
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: 'lazy' }],
      'no-extra-semi': 1,
    },
  }),
];
*/

export default [
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: 'lazy' }],
            'no-extra-semi': 1,
        },
    }
]