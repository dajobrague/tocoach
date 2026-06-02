import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

const root = resolve(__dirname);

// Integration tests run against the local Supabase stack. Load .env.test into
// the test environment so the service-role client can connect.
const testEnv = loadEnv({ path: resolve(root, ".env.test") }).parsed ?? {};

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
    env: testEnv,
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
    // Run serially (no file-level parallelism) so tests sharing the one test
    // tenant never race on insert/cleanup.
    fileParallelism: false,
  },
});
