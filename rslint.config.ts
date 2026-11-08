import { defineConfig, js, ts } from '@rslint/core';

export default defineConfig([
  { ignores: ['dist/**', '.testbuild/**', 'node_modules/**'] },
  js.configs.recommended,
  ts.configs.recommended,
]);
