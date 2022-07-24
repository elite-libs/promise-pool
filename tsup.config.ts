import type { Format, Options } from 'tsup';

const format: Format[] = ['cjs', 'esm', 'iife'];

const env: 'production' | 'development' =
  process.env.NODE_ENV === 'production' ? 'production' : 'development';
const isProd = env === 'production';

const singleBundleFile = Boolean(process.env.BUNDLE_ALL);

export default {
  format,
  outDir: 'dist',
  platform: 'node',
  target: 'es2020',
  entry: ['src/index.ts'],
  globalName: 'PromisePool',
  clean: true,
  bundle: true,
  dts: false,
  metafile: true,
  minify: isProd,
  // skipNodeModulesBundle: singleBundleFile,
  splitting: true,
  sourcemap: true,
  noExternal: [/lodash\/.*/, 'ms'],
} as Options;
