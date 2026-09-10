import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

function pngSize(buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("manifest references the versioned EntoField app icons", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("public/manifest.webmanifest", root), "utf8"),
  );
  assert.equal(manifest.id, "/");
  assert.deepEqual(
    manifest.icons.map((icon) => icon.src),
    [
      "/entofield-app-icon-v3-192.png",
      "/entofield-app-icon-v3-512.png",
      "/entofield-app-icon-v3-1024.png",
    ],
  );
});

test("versioned app and Apple icons have valid square dimensions", async () => {
  for (const [filename, size] of [
    ["entofield-app-icon-v3-192.png", 192],
    ["entofield-app-icon-v3-512.png", 512],
    ["entofield-app-icon-v3-1024.png", 1024],
    ["entofield-apple-touch-icon-v3.png", 180],
    ["entofield-favicon-v3.png", 64],
  ]) {
    const icon = await readFile(new URL(`public/${filename}`, root));
    assert.deepEqual(pngSize(icon), { width: size, height: size });
  }
});

test("page metadata exposes the dedicated Apple icon", async () => {
  const layout = await readFile(new URL("app/layout.tsx", root), "utf8");
  assert.match(layout, /entofield-apple-touch-icon-v3\.png/);
  assert.match(layout, /entofield-favicon-v3\.png/);
});
