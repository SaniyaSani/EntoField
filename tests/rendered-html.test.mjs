import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("event photo picker allows the Photo Library on mobile", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const quickPhotoPicker = source.match(
    /<strong>\{photoBusy[\s\S]*?Create from photo[\s\S]*?<input[\s\S]*?\/>/,
  )?.[0];

  assert.ok(quickPhotoPicker, "event photo picker should be present");
  assert.match(quickPhotoPicker, /accept="image\/\*"/);
  assert.doesNotMatch(
    quickPhotoPicker,
    /\bcapture=/,
    "capture would force the camera instead of allowing Photo Library selection",
  );
});

test("label studio exposes both label types and an exact PDF preview", async () => {
  const source = await readFile(
    new URL("../app/label-studio.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Collection \+ determination labels/);
  assert.match(source, /Single shared grid/);
  assert.match(source, /Double guides/);
  assert.match(source, /No guides/);
  assert.match(source, /Exact A4 label PDF preview/);
  assert.match(source, /Group by label type/);
  assert.match(source, /Keep record pairs/);
});
