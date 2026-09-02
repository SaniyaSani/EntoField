import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  DEFAULT_COLLECTION_LABEL_SETTINGS,
  DEFAULT_DETERMINATION_LABEL_SETTINGS,
  buildCollectionLabelLines,
  buildDeterminationLabelLines,
  formatCoordinatesForLabel,
  formatCollectionDate,
  makeCollectionLabelJobs,
  makeDeterminationLabelJobs,
  makeMultiEventCollectionLabelJobs,
} from "../lib/labels.ts";

const event = {
  id: "EF-20260831-001",
  name: "Meadow edge",
  date: "2026-08-31",
  time: "14:37",
  country: "Switzerland",
  region: "Zürich",
  locality: "Männedorf, Üetiker Ried",
  latitude: 47.24281,
  longitude: 8.69214,
  uncertainty: 6,
  altitude: 430,
  coordinateSource: "device GPS",
  collector: "Saniya Sagutdinova; Kimberly Rothmund",
  method: "sweep net",
  habitat: "meadow edge",
  host: "",
  weather: "",
  notes: "",
  photos: [],
  createdAt: "2026-08-31T14:37:00.000Z",
};

const records = [
  {
    id: "EF-20260831-001-S01",
    eventId: event.id,
    recordType: "specimen",
    quantity: 1,
    scientificName: "Lucilia cf. sericata",
    identifier: "Saniya Sagutdinova",
    sex: "female",
    lifeStage: "adult",
    notes: "",
    photos: [],
    createdAt: event.createdAt,
  },
  {
    id: "EF-20260831-001-L01",
    eventId: event.id,
    recordType: "lot",
    quantity: 11,
    scientificName: "",
    identifier: "",
    sex: "",
    lifeStage: "adult",
    notes: "",
    photos: [],
    createdAt: event.createdAt,
  },
];

const secondEvent = {
  ...event,
  id: "EF-20260831-002",
  name: "Forest stream",
  locality: "Küsnacht, Schübelweiher",
  latitude: 47.3112,
  longitude: 8.5901,
  altitude: 507,
  time: "16:05",
};

test("formats compact collection metadata with Unicode locality", () => {
  assert.equal(formatCollectionDate(event.date, "roman"), "31.VIII.2026");
  const lines = buildCollectionLabelLines(event, event.id, {
    includeCoordinates: true,
    coordinateFormat: "wgs84",
    shortenCollectorNames: true,
    dateFormat: "roman",
  });
  assert.match(lines[0].text, /EF-20260831-001/);
  assert.match(lines[0].text, /Zürich/);
  assert.match(lines[0].text, /Üetiker Ried/);
  assert.match(lines[1].text, /47\.2428° N/);
  assert.match(lines[2].text, /430 m · 31\.VIII\.2026/);
  assert.match(lines[2].text, /leg\. S\. Sagutdinova, K\. Rothmund/);
});

test("formats WGS84, modern LV95 and legacy LV03 coordinates", () => {
  assert.equal(
    formatCoordinatesForLabel(event.latitude, event.longitude, "wgs84"),
    "47.2428° N, 8.6921° E",
  );
  assert.equal(
    formatCoordinatesForLabel(event.latitude, event.longitude, "lv95"),
    "LV95 E 2'694'902 / N 1'233'190",
  );
  assert.equal(
    formatCoordinatesForLabel(event.latitude, event.longitude, "lv03"),
    "LV03 y 694'902 / x 233'190",
  );
});

test("prints the selected Swiss grid on a collection label", () => {
  const lines = buildCollectionLabelLines(event, event.id, {
    includeCoordinates: true,
    coordinateFormat: "lv95",
    shortenCollectorNames: true,
    dateFormat: "roman",
  });
  assert.equal(lines[1].text, "LV95 E 2'694'902 / N 1'233'190");
});

test("creates one collection label per record, including one for a lot", () => {
  const jobs = makeCollectionLabelJobs({
    event,
    records,
    source: "records",
    copies: 99,
    includeIdentifier: true,
    options: {
      includeCoordinates: true,
      coordinateFormat: "wgs84",
      shortenCollectorNames: true,
      dateFormat: "roman",
    },
    settings: DEFAULT_COLLECTION_LABEL_SETTINGS,
  });
  assert.equal(jobs.length, 2);
  assert.match(jobs[1].lines[0].text, /-L01/);
});

test("combines selected collecting events without inserting page breaks", () => {
  const jobs = makeMultiEventCollectionLabelJobs({
    events: [event, secondEvent],
    records,
    source: "quick",
    copiesByEvent: { [event.id]: 2, [secondEvent.id]: 3 },
    includeIdentifier: true,
    options: {
      includeCoordinates: true,
      coordinateFormat: "wgs84",
      shortenCollectorNames: true,
      dateFormat: "roman",
    },
    settings: DEFAULT_COLLECTION_LABEL_SETTINGS,
  });
  assert.equal(jobs.length, 5);
  assert.match(jobs[0].lines[0].text, new RegExp(event.id));
  assert.match(jobs[2].lines[0].text, new RegExp(secondEvent.id));
  assert.match(jobs[2].lines[0].text, /Schübelweiher/);
});

test("determination jobs remain separate and skip unidentified material", () => {
  const jobs = makeDeterminationLabelJobs({
    records,
    options: {
      shortenIdentifierNames: true,
      identificationYear: "2026",
    },
    settings: DEFAULT_DETERMINATION_LABEL_SETTINGS,
  });
  assert.equal(jobs.length, 1);
  assert.deepEqual(buildDeterminationLabelLines(records[0], {
    shortenIdentifierNames: true,
    identificationYear: "2026",
  }), [
    { text: "EF-20260831-001-S01", style: "bold" },
    { text: "Lucilia cf. sericata", style: "italic" },
    { text: "det. S. Sagutdinova 2026", style: "regular" },
  ]);
});

test("creates a readable A4 PDF with embedded Unicode fonts", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (resource) => {
    const path = String(resource);
    if (!path.startsWith("/fonts/")) return originalFetch(resource);
    const bytes = await readFile(new URL(`../public${path}`, import.meta.url));
    return new Response(bytes, { status: 200 });
  };
  try {
    const jobs = makeMultiEventCollectionLabelJobs({
      events: [event, secondEvent],
      records,
      source: "quick",
      copiesByEvent: { [event.id]: 12, [secondEvent.id]: 12 },
      includeIdentifier: true,
      options: {
        includeCoordinates: true,
        coordinateFormat: "wgs84",
        shortenCollectorNames: true,
        dateFormat: "roman",
      },
      settings: DEFAULT_COLLECTION_LABEL_SETTINGS,
    });
    const { createLabelsPdf } = await import("../lib/labels-pdf.ts");
    const result = await createLabelsPdf(jobs, "Combined field trip labels test");
    assert.equal(result.overflowCount, 0);
    assert.equal(jobs.length, 24);
    assert.ok(result.bytes.byteLength > 5_000);
    const parsed = await PDFDocument.load(result.bytes);
    assert.equal(parsed.getPageCount(), 1);

    const swissJobs = makeMultiEventCollectionLabelJobs({
      events: [event, secondEvent],
      records,
      source: "quick",
      copiesByEvent: { [event.id]: 12, [secondEvent.id]: 12 },
      includeIdentifier: true,
      options: {
        includeCoordinates: true,
        coordinateFormat: "lv95",
        shortenCollectorNames: true,
        dateFormat: "roman",
      },
      settings: DEFAULT_COLLECTION_LABEL_SETTINGS,
    });
    const swissResult = await createLabelsPdf(
      swissJobs,
      "Swiss LV95 field trip labels test",
    );
    assert.equal(swissResult.overflowCount, 0);
    assert.equal((await PDFDocument.load(swissResult.bytes)).getPageCount(), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
