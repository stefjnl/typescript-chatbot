import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["test/setup.ts"],
    coverage: {
      provider: "istanbul",
      reportsDirectory: "coverage",
      reporter: ["text", "html"],
    },
    include: ["**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules",
      ".next",
      "coverage",
      "dist",
      "build",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
