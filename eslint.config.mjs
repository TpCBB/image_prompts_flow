import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: path.dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'local_data/**', 'coverage/**', 'output/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Responsive static derivatives avoid an online image optimization service.
    files: ['src/components/PromptCard.tsx', 'src/components/PromptModal.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  {
    files: ['src/**'],
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  },
];

export default config;
