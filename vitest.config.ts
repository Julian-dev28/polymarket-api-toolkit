export default {
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json"],
      thresholds: {
        global: { branches: 70, functions: 70, lines: 70, statements: 70 },
      },
    },
  },
};
