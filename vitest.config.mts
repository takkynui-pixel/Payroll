import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@payroll$/, replacement: root("./supabase/functions/_shared/payroll/index.ts") },
      { find: /^@payroll\//, replacement: root("./supabase/functions/_shared/payroll/") },
      { find: /^@\//, replacement: root("./") },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
