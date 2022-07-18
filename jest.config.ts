import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  // testEnvironment: 'jsdom',
  verbose: true,

  testEnvironment: 'node',
  maxWorkers: 3,
  rootDir: '.',
  // listTests: true,
  testPathIgnorePatterns: ['node_modules', 'dist'],
  resetMocks: true,
  resetModules: true,
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  transform: {},
};

export default config;
