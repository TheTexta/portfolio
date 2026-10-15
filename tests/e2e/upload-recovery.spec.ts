import { expect, test } from "@playwright/test";
import { DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS } from "../../lib/photo-graph/graph-controls";
import { DEFAULT_SPARSE_EDGE_GENERATION_CONFIG } from "../../lib/photo-graph/sparse-edge-generation";

test("a missing original can be reselected and resumed only with matching bytes", async ({
  page,
  context,
}) => {
  const objectPath =
    "photography-images/_pending/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png";
  const original = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const signingPaths: unknown[] = [];
  let uploads = 0;
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/api/admin/photo-graph/graph**", (route) =>
    route.fulfill({
      json: {
        source: "database",
        nodes: [],
        links: [],
        writesEnabled: true,
        defaultEdgeGeneration: DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
        defaultGraphControls: DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS,
      },
    }),
  );
  await context.route("**/api/admin/photo-graph/upload-url", (route) => {
    signingPaths.push(route.request().postDataJSON().storagePath);
    return route.fulfill({
      json: { ok: true, bucket: "dextery.dev", objectPath, token: "test-only" },
    });
  });
  await context.route("**/storage/v1/object/upload/sign/**", (route) => {
    uploads++;
    return route.fulfill(
      uploads === 1
        ? { status: 503, json: { message: "Original was not received" } }
        : { json: { Key: "test-upload" } },
    );
  });
  await context.route("**/api/admin/photo-graph/upload-status", (route) =>
    route.fulfill({ json: { ok: true, present: [], missing: [objectPath] } }),
  );
  await context.route("**/api/admin/photo-graph/upload", (route) =>
    route.fulfill({
      json: {
        ok: true,
        createdIds: ["102"],
        nodeCount: 1,
        edgeCount: 0,
        edgeGenerationConfig: DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
      },
    }),
  );
  expect(
    (
      await context.request.post("/api/admin/photo-graph/login", {
        data: { email: "admin@example.test", password: "test-password" },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/admin");
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: original,
  });
  await page.getByRole("button", { name: "Upload + Update Graph" }).click();
  await expect(
    page.getByText("Original was not received", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Retry registration" }).click();
  await expect(
    page.getByText(
      "Reselect the original file test.png, then retry registration. Recovery metadata has been retained.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(original.length, 0),
  });
  await page.getByRole("button", { name: "Retry registration" }).click();
  await expect(
    page.getByText(
      "The selected test.png differs from the original. Select the original image.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(uploads).toBe(1);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: original,
  });
  await page.getByRole("button", { name: "Retry registration" }).click();
  await expect(page.getByText("Created node IDs: 102")).toBeVisible();
  expect(uploads).toBe(2);
  expect(signingPaths).toEqual([undefined, objectPath]);
});

test("failed registration survives reload and retries the same batch without reuploading", async ({
  page,
  context,
}) => {
  const registrations: unknown[] = [];
  let signedUrlRequests = 0;
  await context.route("https://**/*", (route) => route.abort());
  await page.route("**/api/admin/photo-graph/graph**", (route) =>
    route.fulfill({
      json: {
        source: "database",
        nodes: [],
        writesEnabled: true,
        links: [],
        defaultEdgeGeneration: DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
        defaultGraphControls: DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS,
      },
    }),
  );
  await page.route("**/api/admin/photo-graph/upload-url", (route) => {
    signedUrlRequests++;
    return route.fulfill({
      json: {
        ok: true,
        bucket: "dextery.dev",
        objectPath:
          "photography-images/_pending/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png",
        token: "test-only",
      },
    });
  });
  await page.route("**/api/admin/photo-graph/upload-status", (route) =>
    route.fulfill({
      json: {
        ok: true,
        missing: [],
        present:
          route
            .request()
            .postDataJSON()
            .items?.map((item: { storagePath: string }) => item.storagePath) ??
          route.request().postDataJSON().paths,
      },
    }),
  );
  await context.route("**/storage/v1/object/upload/sign/**", (route) =>
    route.fulfill({ json: { Key: "test-upload" } }),
  );
  await page.route("**/api/admin/photo-graph/upload", async (route) => {
    registrations.push(route.request().postDataJSON());
    if (registrations.length === 1)
      return route.fulfill({
        status: 503,
        json: { error: "Simulated transaction failure. Retry registration." },
      });
    return route.fulfill({
      json: {
        ok: true,
        createdIds: ["100"],
        nodeCount: 1,
        edgeCount: 0,
        edgeGenerationConfig: DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
      },
    });
  });
  const login = await context.request.post("/api/admin/photo-graph/login", {
    data: { email: "admin@example.test", password: "test-password" },
  });
  expect(login.ok()).toBeTruthy();
  await page.goto("/admin");
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Upload + Update Graph" }).click();
  await expect(
    page.getByText("Simulated transaction failure. Retry registration.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry registration" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Retry registration" }).click();
  await expect(page.getByText("Created node IDs: 100")).toBeVisible();
  expect(registrations).toHaveLength(2);
  expect(registrations[1]).toEqual(registrations[0]);
  expect(signedUrlRequests).toBe(1);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("photo-graph-upload-recovery-v1"),
    ),
  ).toBeNull();
});

test("R2 staging upload preserves its provider and immutable batch across registration retries", async ({
  page,
  context,
}) => {
  const objectPath = "staging/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png";
  const original = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const registrations: unknown[] = [];
  const signedRequests: unknown[] = [];
  const statusRequests: unknown[] = [];
  let directUploads = 0;
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/api/admin/photo-graph/graph**", (route) =>
    route.fulfill({
      json: {
        source: "database",
        nodes: [],
        links: [],
        writesEnabled: true,
        defaultEdgeGeneration: DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
        defaultGraphControls: DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS,
      },
    }),
  );
  await context.route("**/api/admin/photo-graph/upload-url", (route) => {
    const request = route.request().postDataJSON();
    signedRequests.push(request);
    return route.fulfill({
      json: {
        ok: true,
        storageProvider: "r2",
        bucket: "dextery-photo-graph-staging",
        objectPath,
        signedUrl: "https://example.r2.cloudflarestorage.com/test-upload",
        headers: {
          "Content-Type": "image/png",
          "x-amz-checksum-sha256": Buffer.from(request.sha256, "hex").toString(
            "base64",
          ),
          "x-amz-meta-sourcesha256": request.sha256,
          "x-amz-meta-expectedsize": String(request.size),
        },
        expiresInSeconds: 3600,
      },
    });
  });
  await context.route(
    "https://example.r2.cloudflarestorage.com/test-upload",
    (route) => {
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "PUT, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, x-amz-checksum-sha256, x-amz-meta-sourcesha256, x-amz-meta-expectedsize",
      };
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers });
      }
      directUploads++;
      expect(route.request().method()).toBe("PUT");
      const signed = signedRequests[0] as { sha256: string; size: number };
      expect(route.request().headers()["x-amz-meta-sourcesha256"]).toBe(
        signed.sha256,
      );
      expect(route.request().headers()["x-amz-meta-expectedsize"]).toBe(
        String(signed.size),
      );
      expect(route.request().headers()["x-amz-checksum-sha256"]).toBe(
        Buffer.from(signed.sha256, "hex").toString("base64"),
      );
      return route.fulfill({ status: 200, headers });
    },
  );
  await context.route("**/api/admin/photo-graph/upload-status", (route) => {
    statusRequests.push(route.request().postDataJSON());
    return route.fulfill({
      json: { ok: true, present: [objectPath], missing: [] },
    });
  });
  await context.route("**/api/admin/photo-graph/upload", (route) => {
    registrations.push(route.request().postDataJSON());
    if (registrations.length === 1) {
      return route.fulfill({
        status: 503,
        json: { error: "Retry registration." },
      });
    }
    return route.fulfill({
      json: {
        ok: true,
        createdIds: ["128"],
        nodeCount: 1,
        edgeCount: 0,
        edgeGenerationConfig: DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
      },
    });
  });
  const login = await context.request.post("/api/admin/photo-graph/login", {
    data: { email: "admin@example.test", password: "test-password" },
  });
  expect(login.ok()).toBeTruthy();
  await page.goto("/admin");
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: original,
  });
  await page.getByRole("button", { name: "Upload + Update Graph" }).click();
  await expect(
    page.getByText("Retry registration.", { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("photo-graph-upload-recovery-v1")!),
  );
  expect(saved.uploads[0]).toMatchObject({
    storagePath: objectPath,
    storageProvider: "r2",
    sourceSize: original.length,
    contentType: "image/png",
  });
  await page.reload();
  await page.getByRole("button", { name: "Retry registration" }).click();
  await expect(page.getByText("Created node IDs: 128")).toBeVisible();
  expect(directUploads).toBe(1);
  expect(registrations).toHaveLength(2);
  expect(registrations[1]).toEqual(registrations[0]);
  expect(signedRequests).toHaveLength(1);
  expect((signedRequests[0] as { sha256: string }).sha256).toMatch(
    /^[a-f0-9]{64}$/,
  );
  expect(statusRequests).toHaveLength(1);
  expect(statusRequests[0]).toMatchObject({
    items: [
      {
        storagePath: objectPath,
        storageProvider: "r2",
        sourceSize: original.length,
      },
    ],
  });
});

test("a lost Storage response retains intent and another tab cannot seal an active batch", async ({
  page,
  context,
}) => {
  const objectPath =
    "photography-images/_pending/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png";
  let release!: () => void;
  const stalled = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const uploading = new Promise<void>((resolve) => {
    started = resolve;
  });
  let registrations = 0;
  let uploads = 0;
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/api/admin/photo-graph/graph**", (route) =>
    route.fulfill({
      json: {
        source: "database",
        nodes: [],
        links: [],
        writesEnabled: true,
        defaultEdgeGeneration: DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
        defaultGraphControls: DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS,
      },
    }),
  );
  await context.route("**/api/admin/photo-graph/upload-url", (route) =>
    route.fulfill({
      json: { ok: true, bucket: "dextery.dev", objectPath, token: "test-only" },
    }),
  );
  await context.route("**/api/admin/photo-graph/upload-status", (route) =>
    route.fulfill({ json: { ok: true, missing: [], present: [objectPath] } }),
  );
  await context.route("**/storage/v1/object/upload/sign/**", async (route) => {
    uploads++;
    started();
    await stalled;
    await route.fulfill({
      status: 503,
      json: { message: "Response lost after acceptance" },
    });
  });
  await context.route("**/api/admin/photo-graph/upload", (route) => {
    registrations++;
    return route.fulfill({
      json: {
        ok: true,
        createdIds: ["101"],
        nodeCount: 1,
        edgeCount: 0,
        edgeGenerationConfig: DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
      },
    });
  });
  expect(
    (
      await context.request.post("/api/admin/photo-graph/login", {
        data: { email: "admin@example.test", password: "test-password" },
      })
    ).ok(),
  ).toBeTruthy();
  const second = await context.newPage();
  await page.goto("/admin");
  await second.goto("/admin");
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Upload + Update Graph" }).click();
  try {
    await uploading;
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("photo-graph-upload-recovery-v1")!),
    );
    expect(saved.uploads[0].storagePath).toBe(objectPath);
    expect(saved.phase).toBe("uploading");
    await expect(
      second.getByRole("button", { name: "Retry registration" }),
    ).toBeEnabled();
    await second.getByRole("button", { name: "Retry registration" }).click();
    await expect(
      second.getByText(
        "Another admin tab is processing uploads. Wait for it to finish, then retry.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(registrations).toBe(0);
    expect(
      await second.evaluate(
        () =>
          JSON.parse(localStorage.getItem("photo-graph-upload-recovery-v1")!)
            .uploadId,
      ),
    ).toBe(saved.uploadId);
  } finally {
    release();
  }
  await expect(
    page.getByText("Response lost after acceptance", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Retry registration" }).click();
  await expect(page.getByText("Created node IDs: 101")).toBeVisible();
  expect(uploads).toBe(1);
  expect(registrations).toBe(1);
  await expect(
    second.getByRole("button", { name: "Upload + Update Graph" }),
  ).toBeDisabled();
});
