const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ], // Properly ignore all _ variables
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn', // Changed to warn
      '@typescript-eslint/no-non-null-assertion': 'warn', // Changed to warn
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-floating-promises': 'warn', // Changed to warn
      '@typescript-eslint/await-thenable': 'warn', // Changed to warn
      '@typescript-eslint/require-await': 'warn', // Changed to warn

      // General best practices
      'no-console': 'off', // Let developers decide
      'no-debugger': 'warn', // Changed to warn
      'no-eval': 'warn', // Changed to warn
      'no-implied-eval': 'warn', // Changed to warn
      'no-new-func': 'warn', // Changed to warn
      'no-script-url': 'warn', // Changed to warn
      'no-void': 'warn', // Changed to warn
      'prefer-const': 'warn', // Changed to warn
      'no-var': 'warn', // Changed to warn
      'object-shorthand': 'warn', // Changed to warn
      'prefer-template': 'warn', // Changed to warn
      'prefer-arrow-callback': 'warn', // Changed to warn
      'comma-dangle': 'warn',
      'comma-spacing': 'warn',
      'computed-property-spacing': 'warn',
      'func-call-spacing': 'warn',
      'key-spacing': 'warn',
      'keyword-spacing': 'warn',
      'linebreak-style': 'warn',
      'no-multiple-empty-lines': 'warn',
      'no-trailing-spaces': 'warn',
      'object-curly-spacing': 'warn',
      'padded-blocks': 'warn',
      'quote-props': 'warn',
      quotes: 'warn',
      semi: 'warn',
      'space-before-blocks': 'warn',
      'space-before-function-paren': 'warn',
      'space-in-parens': 'warn',
      'space-infix-ops': 'warn',
      'space-unary-ops': 'warn',
      'spaced-comment': 'warn',

      // Security specific rules
      'no-eval': 'warn',
      'no-implied-eval': 'warn',
      'no-new-func': 'warn',
      'no-script-url': 'warn',

      // Promise rules
      'prefer-promise-reject-errors': 'warn',
      'no-return-await': 'warn',
      'require-await': 'warn',

      // Error handling
      'no-throw-literal': 'warn',

      // Code style
      'max-len': 'warn',
      indent: 'off', // Let Prettier handle this
      'object-curly-spacing': 'off', // Let Prettier handle this
      'quote-props': 'off', // Let Prettier handle this
      quotes: 'off', // Let Prettier handle this
      semi: 'off', // Let Prettier handle this
      'space-before-blocks': 'off', // Let Prettier handle this
      'space-before-function-paren': 'off', // Let Prettier handle this
      'space-in-parens': 'off', // Let Prettier handle this
      'space-infix-ops': 'off', // Let Prettier handle this
      'space-unary-ops': 'off', // Let Prettier handle this
      'spaced-comment': 'off', // Let Prettier handle this
      'comma-dangle': 'off', // Let Prettier handle this
      'comma-spacing': 'off', // Let Prettier handle this
      'computed-property-spacing': 'off', // Let Prettier handle this
      'func-call-spacing': 'off', // Let Prettier handle this
      'key-spacing': 'off', // Let Prettier handle this
      'keyword-spacing': 'off', // Let Prettier handle this
      'linebreak-style': 'off', // Let Prettier handle this
      'no-multiple-empty-lines': 'off', // Let Prettier handle this
      'no-trailing-spaces': 'off', // Let Prettier handle this
      'padded-blocks': 'off', // Let Prettier handle this
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: {
        jest: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.js', 'coverage/'],
  },
];
