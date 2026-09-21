import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the EntoField brand asset directly", async () => {
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
  const html = await response.text();
  assert.match(html, /src="\/entofield-logo\.png"/);
  assert.doesNotMatch(html, /_next\/image[^"']*entofield-logo/);
});

test("first-launch tutorial can be replayed from Settings", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /TUTORIAL_STORAGE_KEY/);
  assert.match(source, /Replay tutorial/);
  assert.match(source, /Start a field trip/);
  assert.match(css, /\.tour-card/);
  assert.match(css, /\.tour-highlight/);
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

test("copy-count fields can be cleared before a replacement number is typed", async () => {
  const [labelStudio, page] = await Promise.all([
    readFile(new URL("../app/label-studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(labelStudio, /value=\{copiesByEvent\[event\.id\] \|\| ""\}/);
  assert.match(labelStudio, /value === 0 \? 0/);
  assert.match(labelStudio, /onBlur=\{\(\) => commitCopies\(event\.id\)\}/);
  assert.match(page, /value=\{bulkCount \|\| ""\}/);
  assert.match(page, /value=\{draft\.quantity \|\| ""\}/);
});
