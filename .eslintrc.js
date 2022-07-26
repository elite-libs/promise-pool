/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  env: {
    browser: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    // 'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'es2021',
    sourceType: 'module',
    project: './tsconfig.eslint.json',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-redeclare': 'off',
    '@typescript-eslint/lines-between-class-members': 'off',
    eqeqeq: ['error', 'smart'],
    'max-len': [
      'error',
      {
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
        ignoreComments: true,
        code: 100,
      },
    ],
    'array-bracket-newline': [
      'error',
      {
        multiline: true,
        minItems: 2,
      },
    ],
    'object-curly-newline': [
      'error',
      {
        ObjectExpression: 'always',
        ObjectPattern: {
          multiline: true,
          minProperties: 2,
        },
        ImportDeclaration: {
          multiline: true,
          minProperties: 2,
        },
        ExportDeclaration: 'never',
      },
    ],
    'function-paren-newline': [
      'error',
      {
        minItems: 3,
      },
    ],
    'array-element-newline': [
      'error',
      {
        ArrayExpression: {
          minItems: 2,
          multiline: true,
        },
        // "consistent",
        ArrayPattern: {
          minItems: 2,
          multiline: true,
        },
      },
    ],
    // 'lines-between-class-members': [
    //   'error',
    //   'always',
    //   {
    //     exceptAfterSingleLine: true,
    //   },
    // ],
    // 'padding-line-between-statements': [
    //   'error',
    //   {
    //     blankLine: 'always',
    //     prev: ['const', 'let', 'var'],
    //     next: '*',
    //   },
    //   {
    //     blankLine: 'any',
    //     prev: ['const', 'let', 'var'],
    //     next: ['const', 'let', 'var'],
    //   },
    // ],
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-misused-new': 'error',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/member-delimiter-style': [
      'error',
      {
        multiline: {
          delimiter: 'semi',
          requireLast: true,
        },
        singleline: {
          delimiter: 'semi',
          requireLast: false,
        },
        multilineDetection: 'brackets',
      },
    ],
    'import/prefer-default-export': 'off',
    // consistent-type-imports
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
      },
    ],
    '@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],

    '@typescript-eslint/member-ordering': [
      'error',
      {
        default: [
          'public-static-field',
          'static-field',
          'instance-field',
          'signature',
          'method',
          'constructor',
          'field',
        ],
      },
    ],

    'no-underscore-dangle': 'off',
    // Promise & async checks
    '@typescript-eslint/await-thenable': 'off',
    '@typescript-eslint/no-floating-promises': [
      'error',
      {
        ignoreVoid: true,
      },
    ],
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksConditionals: true,
        checksVoidReturn: true,
        checksSpreads: true,
      },
    ],
    '@typescript-eslint/no-unnecessary-type-assertion': ['error'],
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/prefer-includes': 'warn',
    // NOTE: Disable "prefer-function-type" if annoying!
    '@typescript-eslint/prefer-function-type': 'warn',
  },
};
