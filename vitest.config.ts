import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: "text",
      provider: "v8",
      include: ["src/**/*.ts"],
    },
  },
});
