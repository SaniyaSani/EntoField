import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_COLLECTION_SOURCE,
  DEFAULT_INCLUDE_COLLECTION_IDENTIFIER,
  MAX_LABEL_COPIES,
  normalizeLabelCopies,
} from "../lib/label-studio-options.ts";

test("collection defaults are copies per event without event identifiers", () => {
  assert.equal(DEFAULT_COLLECTION_SOURCE, "quick");
  assert.equal(DEFAULT_INCLUDE_COLLECTION_IDENTIFIER, false);
});

test("copy counts are normalized only when committed", () => {
  for (const [input, expected] of [["", 1], ["0", 1], ["1", 1], ["50", 50], ["150", 150], ["200", 200], ["999", MAX_LABEL_COPIES], ["0050", 50], ["invalid", 1], [Infinity, 1], [-3, 1], [1.9, 1]]) {
    assert.equal(normalizeLabelCopies(input), expected);
  }
});

test("Label Studio uses independent options and preserves the chosen copy mode", async () => {
  const studio = await readFile(new URL("../app/label-studio.tsx", import.meta.url), "utf8");
  assert.match(studio, /DEFAULT_COLLECTION_SOURCE,\s*\)/);
  assert.match(studio, /useState\(DEFAULT_INCLUDE_COLLECTION_IDENTIFIER\)/);
  assert.match(studio, /function chooseMode\(nextMode: LabelMode\) \{\s*setMode\(nextMode\);\s*\}/);
  assert.match(studio, /checked=\{includeCoordinates\}/);
  assert.match(studio, /checked=\{includeAltitude\}/);
  assert.doesNotMatch(studio, /Print coordinates and altitude/);
});

test("PDF work is cancellable, paused during typing, and downloads only the current result", async () => {
  const studio = await readFile(new URL("../app/label-studio.tsx", import.meta.url), "utf8");
  assert.match(studio, /if \(copiesEditing \|\| !jobs.length\) return/);
  assert.match(studio, /new Worker\(new URL\("\.\.\/lib\/labels-pdf.worker.ts", import.meta.url\)/);
  assert.match(studio, /worker\?\.terminate\(\)/);
  assert.match(studio, /preview\?\.request === pdfRequest/);
  assert.match(studio, /if \(!jobs.length \|\| copiesEditing \|\| !previewIsCurrent \|\| !preview\) return/);
  assert.doesNotMatch(studio, /await createLabelsPdf/);
});
