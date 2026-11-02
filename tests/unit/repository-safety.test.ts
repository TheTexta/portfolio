import { describe, expect, it } from "vitest";

import { findUnsafeTrackedFiles } from "../../scripts/security/check-tracked-files";

describe("tracked repository files", () => {
  it("rejects temporary deployment snapshots at any depth", () => {
    const paths = [
      ".tmp/coolify-live/supabase.env",
      ".tmp/coolify-live/supabase-compose.yml",
      ".tmp/coolify-live/redis-compose.yml",
      "nested/.tmp/diagnostic.json",
    ];
    expect(findUnsafeTrackedFiles(paths)).toEqual(paths);
  });

  it("rejects both dotenv and suffix-style environment files", () => {
    const paths = [
      ".env",
      ".env.local",
      "deploy/supabase.env",
      "nested/service.env.production",
      "deploy/SUPABASE.ENV",
    ];
    expect(findUnsafeTrackedFiles(paths)).toEqual(paths);
  });

  it("allows application code, documentation and deployment templates without env suffixes", () => {
    expect(
      findUnsafeTrackedFiles([
        "app/page.tsx",
        "lib/environment.ts",
        "docs/security/credential-exposure.md",
        "deploy/service/compose.yml",
        "scripts/security/check-tracked-files.ts",
        "tests/unit/repository-safety.test.ts",
        ".gitignore",
      ]),
    ).toEqual([]);
  });

  it("handles an empty index", () => {
    expect(findUnsafeTrackedFiles([])).toEqual([]);
  });
});
