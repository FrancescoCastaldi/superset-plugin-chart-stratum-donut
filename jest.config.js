module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts', '<rootDir>/test/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false }],
  },
  // The tested functions are pure: the @superset-ui modules are replaced by a local double.
  moduleNameMapper: {
    '^@superset-ui/core$': '<rootDir>/test/__mocks__/supersetCoreMock.js',
    '^@superset-ui/chart-controls$': '<rootDir>/test/__mocks__/supersetCoreMock.js',
  },
};
