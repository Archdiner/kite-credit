/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
    },
    testMatch: ["**/__tests__/*.integration.test.ts"],
    setupFiles: ["<rootDir>/jest.integration.setup.js"],
    // Give DB calls more time
    testTimeout: 15000,
};
