module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts', '<rootDir>/test/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false }],
  },
  // Le funzioni testate sono pure: i moduli @superset-ui sono sostituiti da un double locale.
  moduleNameMapper: {
    '^@superset-ui/core$': '<rootDir>/test/__mocks__/supersetCoreMock.js',
    '^@superset-ui/chart-controls$': '<rootDir>/test/__mocks__/supersetCoreMock.js',
  },
};
