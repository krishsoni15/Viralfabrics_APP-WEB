module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        skipLibCheck: true,
        strict: false,
        rootDir: '.',
        isolatedModules: true,
      },
    }],
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/mocks/',
  ],
};
