import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/explicit-member-accessibility': 'error',
      '@typescript-eslint/typedef': ['error', { memberVariableDeclaration: true }],
      '@typescript-eslint/no-inferrable-types': [
        'error',
        { ignoreParameters: true, ignoreProperties: true },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'TSParameterProperty[parameter.type="AssignmentPattern"]:not([parameter.left.typeAnnotation])',
          message: 'Parameter properties must have an explicit type annotation.',
        },
        {
          selector:
            'TSParameterProperty[parameter.type="Identifier"]:not([parameter.typeAnnotation])',
          message: 'Parameter properties must have an explicit type annotation.',
        },
      ],
    },
  },
  eslintConfigPrettier,
);
