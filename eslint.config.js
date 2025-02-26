import { buildConfig } from 'eslint-config-spartan';
import { jsDoc, mdx, prettier, promise, typeEnabled, unicorn, vitest } from 'eslint-config-spartan/mixins';

export default buildConfig(
  typeEnabled({ parserOptions: { tsconfigRootDir: import.meta.dirname, project: './tsconfig.json' } }),
  promise,
  unicorn,
  vitest,
  jsDoc,
  mdx,
  prettier,
  {
    name: 'root/global-ignores',
    ignores: ['test-package/', 'node_modules/', 'coverage/', 'reports/', '.vscode/', 'dist/', '.temp/'],
  },
);
