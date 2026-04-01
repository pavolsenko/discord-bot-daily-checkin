import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        files: ['**/*.{ts,tsx}'],
        ignores: ['**/*.js', 'dist/**', 'node_modules/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended
);
