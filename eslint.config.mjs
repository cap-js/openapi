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
            'no-extra-semi': 1,
        },
    }
]