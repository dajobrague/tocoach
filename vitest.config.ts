import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const root = resolve(__dirname);

// Path aliases mirror tsconfig.json "paths". The specific entries must precede
// the catch-all "@" so Vite matches the most specific alias first.
export default defineConfig({
  // tsconfig.json sets "jsx": "preserve" (Next.js compiles JSX itself), but
  // Vite's oxc transform picks that up too and leaves JSX untouched,
  // producing invalid JS for any .tsx test file. Override the transform mode
  // here — this doesn't change tsconfig or affect the Next.js build, and is a
  // no-op for the existing .ts tests (none contain JSX).
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  resolve: {
    alias: {
      "@/components": resolve(root, "components"),
      "@/lib": resolve(root, "lib"),
      "@/features": resolve(root, "features"),
      "@/types": resolve(root, "types"),
      "@/config": resolve(root, "config"),
      "@/styles": resolve(root, "styles"),
      "@": root,
      "server-only": resolve(root, "lib/test/server-only-stub.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    // Integration tests need the local DB and run via vitest.integration.config.ts.
    // .claude/worktrees holds parallel-session checkouts — never test those here.
    exclude: [
      "node_modules",
      "**/node_modules/**",
      ".next",
      ".claude/**",
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
