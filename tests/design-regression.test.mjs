import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the hand-drawn EntoField identity on the latest feature build", async () => {
  const [page, css, manifest] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  ]);

  assert.match(page, /src="\/entofield-logo\.png"/);
  assert.match(page, /> Collection labels/);
  assert.match(page, /Photo Library or Camera/);
  assert.match(css, /EntoField field-notebook theme/);
  assert.match(css, /--cream: #ffffff/);
  assert.match(css, /box-shadow: 6px 7px 0/);
  assert.equal(JSON.parse(manifest).theme_color, "#1F1A17");
  assert.equal(JSON.parse(manifest).icons[0].src, "/entofield-icon-v3.png");
  assert.equal(JSON.parse(manifest).icons[0].sizes, "1254x1254");

  await Promise.all([
    access(new URL("../public/entofield-logo.png", import.meta.url)),
    access(new URL("../public/entofield-icon-v3.png", import.meta.url)),
  ]);
});
