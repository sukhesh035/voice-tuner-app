import type { Config } from 'jest';

const config: Config = {
  displayName: 'admin-api',
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  coverageDirectory: '<rootDir>/../../coverage/apps/admin-api',
};

export default config;
