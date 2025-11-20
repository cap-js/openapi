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
            'eqeqeq': 'off', // Allow == when appropriate (e.g., null checks)
            'no-sequences': 'off', // Comma operator is useful
            'yoda': ['warn', 'never', { exceptRange: true }], // Natural comparison order, except ranges
            'no-implicit-coercion': 'off', // Allow !!value, +str, etc.
            'no-nested-ternary': 'off', // Allow with proper newlines
            
            // Error Prevention - inspired by Phoenix35/eslint-config
            'no-throw-literal': 'error',
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            
            // Code Quality
            'no-lonely-if': 'warn',
            'no-useless-return': 'warn',
            'prefer-object-spread': 'warn',
            'dot-notation': 'warn',
        },
    }
]
