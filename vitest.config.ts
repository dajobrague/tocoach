import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const root = resolve(__dirname);

// Path aliases mirror tsconfig.json "paths". The specific entries must precede
// the catch-all "@" so Vite matches the most specific alias first.
export default defineConfig({
  resolve: {
    alias: {
      "@/components": resolve(root, "components"),
      "@/lib": resolve(root, "lib"),
      "@/features": resolve(root, "features"),
      "@/types": resolve(root, "types"),
      "@/config": resolve(root, "config"),
      "@/styles": resolve(root, "styles"),
      "@": root,
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    // Integration tests need the local DB and run via vitest.integration.config.ts.
    exclude: [
      "node_modules",
      ".next",
      "tests/e2e/**",
      "**/*.integration.test.ts",
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html"],
    },
  },
});
