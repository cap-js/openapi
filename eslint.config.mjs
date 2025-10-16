import js from '@eslint/js';
import globals from 'globals'

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
            'no-extra-semi': 'warn',
            'max-len': ['warn', { 'code': 120 }],
            'complexity': ['warn', 15],
            'max-params': ['warn', 4],
            'no-param-reassign': 'warn',
            'prefer-const': 'warn',
            'no-var': 'error',
            'object-shorthand': 'warn',
            'prefer-template': 'warn',
            'func-style': ['off'],
            'no-else-return': 'warn',
            'prefer-arrow-callback': 'warn',
            'require-await': 'warn',
            'no-duplicate-imports': 'error',
        },
    }
]
