module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/src/e2e/"],
  setupFiles: ["dotenv/config"],
  clearMocks: true,
  watchman: false
};
