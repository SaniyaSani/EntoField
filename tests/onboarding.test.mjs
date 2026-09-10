import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("starts with a clean field notebook", () => {
  assert.doesNotMatch(source, /Männedorf meadow walk/);
  assert.doesNotMatch(source, /Example collector/);
  assert.doesNotMatch(source, /Include the pink example event/);
  assert.match(source, /trips: \[\],\s*events: \[\],\s*specimens: \[\]/);
});

test("includes a persistent and reopenable first-run tutorial", () => {
  assert.match(source, /entofield:tutorial:v1/);
  assert.match(source, /aria-labelledby="tutorial-title"/);
  assert.match(source, /Start first field trip/);
  assert.match(source, /Open tutorial/);
});
