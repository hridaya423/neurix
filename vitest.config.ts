import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir.replace(/\/$/, ""),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "convex/**/*.test.ts"],
    globals: false,
  },
});
