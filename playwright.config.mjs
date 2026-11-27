import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 30_000,
  use: {
    channel: process.env.BOBOS_BROWSER_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
});
