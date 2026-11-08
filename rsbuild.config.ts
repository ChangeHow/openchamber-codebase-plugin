import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: { index: './src/panel/main.ts', demo: './src/demo/bridge.ts' },
  },
  output: {
    target: 'web',
    module: false,
    assetPrefix: './',
    filenameHash: false,
    sourceMap: { js: false, css: false },
    polyfill: 'off',
  },
  html: {
    template: ({ entryName }) => (entryName === 'demo' ? './src/demo/index.html' : './src/panel/index.html'),
    title: ({ entryName }) => (entryName === 'demo' ? 'Synthetic SDK preview' : 'Codebase CLI Example'),
    scriptLoading: 'defer',
  },
  splitChunks: false,
  tools: { rspack: { output: { iife: true, asyncChunks: false } } },
});
