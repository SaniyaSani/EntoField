import assert from "node:assert/strict";
import { readdir, writeFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  DEFAULT_COLLECTION_LABEL_SETTINGS,
  DEFAULT_LABEL_PAGE_OPTIONS,
  makeMultiEventCollectionLabelJobs,
} from "../lib/labels.ts";

test("production PDF worker generates 150 + 200 coordinate-only labels", { timeout: 20_000 }, async () => {
  const assets = new URL("../dist/client/assets/", import.meta.url);
  const workerName = (await readdir(assets)).find((name) => /^labels-pdf\.worker-.*\.js$/.test(name));
  assert.ok(workerName, "production build must include the PDF worker");
  const workerUrl = new URL(workerName, assets);
  const publicUrl = new URL("../public/", import.meta.url);
  // Run the actual bundled worker with Node adapters for Web Worker I/O and font URLs.
  const adapter = `
    import { parentPort } from 'node:worker_threads';
    import { readFile } from 'node:fs/promises';
    globalThis.self = globalThis;
    globalThis.postMessage = (message, options) => parentPort.postMessage(message, options?.transfer);
    globalThis.fetch = async (path) => new Response(await readFile(new URL(String(path).slice(1), ${JSON.stringify(publicUrl.href)})));
    await import(${JSON.stringify(workerUrl.href)});
    parentPort.on('message', (data) => self.onmessage({ data }));
  `;
  const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(adapter)}`));
  try {
    const base = {
      date: "2026-09-23", time: "20:40", country: "Switzerland", region: "Zürich",
      latitude: 47.3942, longitude: 8.5487, altitude: 513,
      collector: "Example Collector", method: "light trap", habitat: "park",
    };
    const events = [
      { ...base, id: "QA-A", locality: "Test meadow" },
      { ...base, id: "QA-B", locality: "Test woodland" },
    ];
    const jobs = makeMultiEventCollectionLabelJobs({
      events, records: [], source: "quick", copiesByEvent: { "QA-A": 150, "QA-B": 200 },
      includeIdentifier: false,
      options: {
        includeCoordinates: true, includeAltitude: false, coordinateFormat: "wgs84",
        shortenCollectorNames: true, dateFormat: "roman",
      },
      settings: DEFAULT_COLLECTION_LABEL_SETTINGS,
    });
    assert.equal(jobs.length, 350);
    const result = await new Promise((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
      worker.postMessage({ jobs, title: "Coordinate-only label check", options: DEFAULT_LABEL_PAGE_OPTIONS });
    });
    assert.equal(result.error, undefined);
    assert.ok(result.result.bytes instanceof Uint8Array);
    assert.equal(result.result.overflowCount, 0);
    const document = await PDFDocument.load(result.result.bytes);
    assert.ok(document.getPageCount() > 1);
    for (const page of document.getPages()) {
      assert.ok(Math.abs(page.getWidth() - 595.28) < 0.1);
      assert.ok(Math.abs(page.getHeight() - 841.89) < 0.1);
    }
    if (process.env.LABEL_QA_PDF_PATH) await writeFile(process.env.LABEL_QA_PDF_PATH, result.result.bytes);
  } finally {
    await worker.terminate();
  }
});
